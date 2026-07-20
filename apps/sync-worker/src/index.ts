/**
 * Stuff sync worker: two-way sync between Todoist (front-end) and the
 * Stuff Tasks database in Notion (source of truth for agents).
 *
 * Capabilities:
 * - webhook "todoist"        — inbound real-time: Todoist events → Notion
 * - automation "pushToTodoist" — outbound fast path: attach a Stuff Tasks
 *   database automation to this action so human and agent edits in Notion
 *   reach Todoist immediately
 * - tool "reconcile"         — two-way reconcile/backfill; callable by a
 *   Custom Agent (e.g. on a schedule) or `ntn workers exec reconcile`
 *
 * Echo suppression is diff-based: every handler computes the target state
 * and skips writes when the other side already matches, so loops converge.
 */

import crypto from "crypto";
import { Worker, WebhookVerificationError } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import { Client } from "@notionhq/client";

import {
	type Board,
	activeBoards,
	boardForTodoistProject,
	env,
	excludedTodoistProjectIds,
	setSyncTimeZone,
	taskBelongsToBoard,
	todayLocal,
	todoistExternalId,
	todoistIdFromExternalId,
} from "./config.js";
import {
	localDueDate,
	localWhenDate,
	notionUpdateFor,
	notionToTodoistFields,
	todoistToNotionFields,
	todoistUpdateFor,
} from "./mapping.js";
import {
	createTask as createNotionTask,
	findByExternalId,
	findByExternalIdAnyBoard,
	findUnlinkedByName,
	getBotUserId,
	getTask as getNotionTask,
	isClosedStatus,
	listLinkedTasks,
	listOpenTasks,
	updateTask as updateNotionTask,
	type ParsedTask,
} from "./notion-tasks.js";
import { TodoistClient, type TodoistTask } from "./todoist.js";
import { reconcileAttachments } from "./attachments.js";

const worker = new Worker();
// `ntn workers exec --local` resolves the worker via `mod.default.default`
// (CJS interop); expose the instance under both shapes.
export default Object.assign(worker, { default: worker });

// Todoist allows ~450 requests / 15 min; stay well under it.
const todoistPacer = worker.pacer("todoistApi", {
	allowedRequests: 25,
	intervalMs: 60_000,
});

async function todoistWait(): Promise<void> {
	try {
		await todoistPacer.wait();
	} catch {
		// The pacer service only exists in the deployed runtime; during
		// `ntn workers exec --local`, fall back to fixed request spacing.
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
}

const todoist = new TodoistClient(todoistWait);

// Keep the worker's "today" aligned with the Todoist account timezone.
// Memoized per process with a TTL so a warm runtime does not re-fetch on
// every webhook; a cold start pays one extra Sync call. The timestamp
// advances only on success, so transient failures retry and self-heal.
let tzCheckedAt = 0;
const TZ_TTL_MS = 6 * 60 * 60 * 1000;
async function refreshTimeZone(): Promise<void> {
	if (Date.now() - tzCheckedAt < TZ_TTL_MS) return;
	try {
		setSyncTimeZone(await todoist.getTimeZone());
		tzCheckedAt = Date.now();
	} catch (error) {
		console.log("timezone refresh failed, using fallback:", error);
	}
}

/**
 * The platform pre-authenticates context.notion only for agent-invoked
 * tools (and env names starting with NOTION_ are reserved, so we cannot
 * push NOTION_API_TOKEN ourselves). Fall back to our own client built
 * from STUFF_NOTION_TOKEN for webhook executions.
 */
function getNotion(context: { notion: Client }): Client {
	if (process.env.NOTION_API_TOKEN) return context.notion;
	return new Client({ auth: env("STUFF_NOTION_TOKEN") });
}

// ---------------------------------------------------------------------------
// Inbound: Todoist webhook → Notion
// ---------------------------------------------------------------------------

interface TodoistWebhookPayload {
	event_name: string;
	event_data: TodoistTask;
	triggered_at?: string;
}

function verifyTodoistSignature(
	rawBody: string,
	headers: Record<string, string>,
): void {
	const secret = process.env.TODOIST_CLIENT_SECRET;
	if (!secret) {
		throw new WebhookVerificationError("TODOIST_CLIENT_SECRET not configured");
	}
	const signature = headers["x-todoist-hmac-sha256"];
	if (!signature) {
		throw new WebhookVerificationError("Missing X-Todoist-Hmac-SHA256 header");
	}
	const expected = crypto
		.createHmac("sha256", secret)
		.update(rawBody)
		.digest("base64");
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
		throw new WebhookVerificationError("Invalid Todoist signature");
	}
}

/** Create the Notion page for a Todoist task, or adopt/update a match. */
async function upsertFromTodoist(
	notion: Client,
	board: Board,
	task: TodoistTask,
): Promise<"created" | "updated" | "unchanged"> {
	const externalId = todoistExternalId(task.id);
	let page = await findByExternalId(notion, board, externalId);

	if (!page) {
		// If our own outbound create raced this webhook, the page exists but
		// its External ID write may not have landed yet — adopt by name.
		const unlinked = await findUnlinkedByName(notion, board, task.content);
		if (unlinked) {
			await updateNotionTask(notion, board, unlinked.pageId, { externalId });
			page = { ...unlinked, externalId };
		}
	}

	if (!page) {
		await createNotionTask(notion, board, {
			...todoistToNotionFields(task),
			status: task.checked
				? board.status.done
				: board.status.openFor(localDueDate(task.due)),
			externalId,
			// On a shared board, a task the user created in Todoist is theirs.
			...(board.ownerFilter
				? { owner: [board.ownerFilter.userId] }
				: {}),
		});
		return "created";
	}

	const update = notionUpdateFor(task, page, board);
	if (update) {
		await updateNotionTask(notion, board, page.pageId, update);
		return "updated";
	}
	return "unchanged";
}

worker.webhook("todoist", {
	title: "Todoist events",
	description:
		"Receives Todoist item webhooks and mirrors them into the Stuff Tasks database.",
	execute: async (events, context) => {
		await refreshTimeZone();
		const notion = getNotion(context);
		for (const event of events) {
			verifyTodoistSignature(event.rawBody, event.headers);
			const payload = event.body as unknown as TodoistWebhookPayload;

			// Comment/note events carry a note (with item_id), not a task, and
			// drive attachment sync. Handle before the task-shaped path below.
			if (payload.event_name.startsWith("note:")) {
				const note = payload.event_data as unknown as { item_id?: string };
				if (!note.item_id) continue;
				const existing = await findByExternalIdAnyBoard(
					notion,
					activeBoards(),
					todoistExternalId(note.item_id),
				);
				if (existing?.board.prop.attachments) {
					const result = await reconcileAttachments(
						notion,
						todoist,
						existing.board,
						existing.page,
						note.item_id,
						true,
					);
					console.log(
						`${payload.event_name} ${note.item_id}: ${JSON.stringify(result)}`,
					);
				}
				continue;
			}

			const task = payload.event_data;
			if (!task?.id) continue;
			if (task.project_id && excludedTodoistProjectIds().has(task.project_id)) {
				continue;
			}

			switch (payload.event_name) {
				case "item:added":
				case "item:updated":
				case "item:completed":
				case "item:uncompleted": {
					// event_data can be stale or partial (e.g. item:added for a
					// create-with-due arrives without the due) — treat the event
					// as a signal and diff against the live task instead. For
					// brand-new items, give Todoist's read path a moment to
					// settle or the live read races the write that fired us.
					if (payload.event_name === "item:added") {
						await new Promise((resolve) => setTimeout(resolve, 5000));
					}
					const live = await todoist.getTask(task.id);
					let result: string;
					if (!live) {
						result = "gone";
					} else {
						// Route by project, but if the task already exists in some
						// board's database, update it there instead: moving a task
						// between Todoist projects must not duplicate it across DBs.
						const existing = await findByExternalIdAnyBoard(
							notion,
							activeBoards(),
							todoistExternalId(live.id),
						);
						const board =
							existing?.board ?? boardForTodoistProject(live.project_id);
						result = await upsertFromTodoist(notion, board, live);
					}
					console.log(`${payload.event_name} ${task.id}: ${result}`);
					break;
				}
				case "item:deleted": {
					const existing = await findByExternalIdAnyBoard(
						notion,
						activeBoards(),
						todoistExternalId(task.id),
					);
					if (
						existing &&
						!isClosedStatus(existing.page.status, existing.board)
					) {
						await updateNotionTask(notion, existing.board, existing.page.pageId, {
							status: existing.board.status.cancelled,
						});
						console.log(`item:deleted ${task.id}: cancelled`);
					}
					break;
				}
				default:
					console.log(`Ignoring event ${payload.event_name}`);
			}
		}
	},
});

// ---------------------------------------------------------------------------
// Outbound: Notion automation → Todoist
// ---------------------------------------------------------------------------

/**
 * Whether a page belongs in the user's Todoist: true on boards with no owner
 * filter, otherwise true when the page is unowned or owned by the filter user.
 */
function ownedByUser(page: ParsedTask, board: Board): boolean {
	if (!board.ownerFilter) return true;
	return (
		page.owner.length === 0 || page.owner.includes(board.ownerFilter.userId)
	);
}

/**
 * Keep "Today" tasks pinned to today: if the page's status is the board's
 * today-status and its Date isn't today, rewrite Date = today (which the
 * normal Date→due sync then pushes to Todoist). Skipped for recurring tasks —
 * their date is owned by Todoist's recurrence. Returns the page with its Date
 * updated so callers push the corrected value.
 */
async function normalizeTodayDate(
	notion: Client,
	board: Board,
	page: ParsedTask,
	isRecurring: boolean,
): Promise<ParsedTask> {
	if (!board.status.today || page.status !== board.status.today) return page;
	if (isRecurring) return page;
	const today = todayLocal();
	if (localWhenDate(page.when) === today) return page;
	await updateNotionTask(notion, board, page.pageId, { when: { start: today } });
	return { ...page, when: today };
}

/** Push one Notion page's state to Todoist (create, update, close, reopen). */
async function pushPageToTodoist(
	notion: Client,
	board: Board,
	page: ParsedTask,
): Promise<string> {
	const todoistId = page.externalId
		? todoistIdFromExternalId(page.externalId)
		: null;

	// On a shared board, only sync tasks the user owns (or that are unowned);
	// tasks belonging solely to a collaborator stay out of the user's Todoist.
	const mine = !board.ownerFilter || ownedByUser(page, board);

	if (!todoistId) {
		// Never linked. Only open, owned tasks are worth creating in Todoist.
		if (isClosedStatus(page.status, board) || !page.name || !mine) {
			return "skipped";
		}
		page = await normalizeTodayDate(notion, board, page, false);
		const created = await todoist.createTask(notionToTodoistFields(page, board));
		await updateNotionTask(notion, board, page.pageId, {
			externalId: todoistExternalId(created.id),
		});
		return "created";
	}

	const task = await todoist.getTask(todoistId);
	if (!task) {
		// The linked Todoist task is gone (deleted in Todoist). If the page is
		// open and owned — e.g. moved from Cancelled back to an open status —
		// revive it: create a fresh task and relink. A closed page has nothing
		// worth recreating.
		if (isClosedStatus(page.status, board) || !page.name || !mine) {
			return "missing-in-todoist";
		}
		page = await normalizeTodayDate(notion, board, page, false);
		const created = await todoist.createTask(notionToTodoistFields(page, board));
		await updateNotionTask(notion, board, page.pageId, {
			externalId: todoistExternalId(created.id),
		});
		return "recreated";
	}

	// A linked task the user no longer owns (reassigned to a collaborator)
	// should leave the user's Todoist. Close rather than delete to keep history.
	if (!mine) {
		if (!task.checked) {
			await todoist.closeTask(todoistId);
			return "closed (not owner)";
		}
		return "skipped (not owner)";
	}

	page = await normalizeTodayDate(
		notion,
		board,
		page,
		Boolean(task.due?.is_recurring),
	);

	const actions: string[] = [];
	const update = todoistUpdateFor(page, task);
	if (update) {
		await todoist.updateTask(todoistId, update);
		actions.push("updated");
	}

	const pageClosed = isClosedStatus(page.status, board);
	if (pageClosed && !task.checked) {
		await todoist.closeTask(todoistId);
		actions.push("closed");
	} else if (!pageClosed && task.checked && !task.due?.is_recurring) {
		// Recurring tasks reopen themselves with the next occurrence;
		// reopening them here would fight Todoist's own scheduling.
		await todoist.reopenTask(todoistId);
		actions.push("reopened");
	}

	return actions.length > 0 ? actions.join("+") : "unchanged";
}

worker.webhook("notionPush", {
	title: "Notion task changed",
	description:
		"Target of the Personal Tasks database automation (page added / property edited → Send webhook): mirrors Notion-side changes to Todoist.",
	execute: async (events, context) => {
		await refreshTimeZone();
		const notion = getNotion(context);
		for (const event of events) {
			// Notion automation webhooks post the triggering page under
			// `data`; tolerate a bare {pageId} for manual invocation too.
			const body = event.body as any;
			const pageId: string | undefined =
				body?.data?.id ?? body?.page?.id ?? body?.pageId;
			if (!pageId) {
				console.log("notionPush: no page id in payload, ignoring");
				continue;
			}
			// Re-read the page: automation payloads can be stale by the
			// time we run, and echoes must diff against current state. The
			// board is resolved from the page's parent data source, so both
			// databases' automations can target this one webhook.
			const { page, board } = await getNotionTask(notion, pageId);
			// Echo guard: if the last edit was made by this integration,
			// the automation fired on our own inbound write — pushing it
			// back out could clear fields mid-settle. Skip; the reconcile
			// tool covers anything genuinely missed.
			if (page.lastEditedBy === (await getBotUserId(notion))) {
				console.log(`notionPush ${pageId}: skipped (own write echo)`);
				continue;
			}
			const result = await pushPageToTodoist(notion, board, page);
			console.log(`notionPush ${pageId}: ${result}`);

			// Sync file attachments (the Attachments property triggers this too).
			const todoistId = page.externalId
				? todoistIdFromExternalId(page.externalId)
				: null;
			if (todoistId && board.prop.attachments) {
				const att = await reconcileAttachments(
					notion,
					todoist,
					board,
					page,
					todoistId,
					true,
				);
				console.log(`notionPush ${pageId}: attachments ${JSON.stringify(att)}`);
			}
		}
	},
});

// ---------------------------------------------------------------------------
// Reconcile: two-way backstop / initial backfill
// ---------------------------------------------------------------------------

worker.tool("reconcile", {
	title: "Reconcile Todoist and Stuff Tasks",
	description:
		"Two-way reconcile between Todoist and the Stuff Tasks database: creates missing counterparts, converges field drift (Todoist wins), and resolves completion mismatches (done wins). Set apply=false to preview.",
	schema: j.object({
		apply: j
			.boolean()
			.describe("true to write changes; false for a dry-run report."),
	}),
	execute: async ({ apply }, context) => {
		await refreshTimeZone();
		const notion = getNotion(context);
		const summary = {
			createdInNotion: 0,
			createdInTodoist: 0,
			updatedInNotion: 0,
			updatedInTodoist: 0,
			closedInTodoist: 0,
			completedInNotion: 0,
			cancelledInNotion: 0,
			rolledToday: 0,
			attachmentsToNotion: 0,
			attachmentsToTodoist: 0,
			attachmentsDeletedNotion: 0,
			attachmentsDeletedTodoist: 0,
		};

		const excluded = excludedTodoistProjectIds();
		const allActiveTasks = await todoist.listActiveTasks();
		const activeTasks = allActiveTasks.filter(
			(task) => !task.project_id || !excluded.has(task.project_id),
		);

		// Reconcile each configured board against the slice of Todoist it owns.
		for (const board of activeBoards()) {
			const [linkedPages, openPages] = await Promise.all([
				listLinkedTasks(notion, board),
				listOpenTasks(notion, board),
			]);
			const boardTasks = activeTasks.filter((task) =>
				taskBelongsToBoard(task.project_id, board),
			);
			const pagesByTodoistId = new Map<string, ParsedTask>();
			for (const page of linkedPages) {
				const id = page.externalId
					? todoistIdFromExternalId(page.externalId)
					: null;
				if (id) pagesByTodoistId.set(id, page);
			}
			const activeById = new Map(boardTasks.map((task) => [task.id, task]));

			// 1. Active in Todoist, missing or drifted in Notion (Todoist wins).
			for (const task of boardTasks) {
				const page = pagesByTodoistId.get(task.id);
				if (!page) {
					if (apply) await upsertFromTodoist(notion, board, task);
					summary.createdInNotion++;
				} else if (!ownedByUser(page, board)) {
					// Linked page reassigned away from the user → close in Todoist.
					if (apply) await todoist.closeTask(task.id);
					summary.closedInTodoist++;
				} else if (isClosedStatus(page.status, board)) {
					// Notion says done/cancelled but Todoist still has it active.
					if (apply) await todoist.closeTask(task.id);
					summary.closedInTodoist++;
				} else {
					const update = notionUpdateFor(task, page, board);
					if (update) {
						if (apply) {
							await updateNotionTask(notion, board, page.pageId, update);
						}
						summary.updatedInNotion++;
					}
				}
			}

			// 2. Open in Notion: unlinked owned pages get created in Todoist;
			//    linked pages missing from the active list were completed or
			//    deleted. Pages the user doesn't own are the board owner's
			//    concern, not the user's Todoist, so they are left alone here
			//    (a still-active not-owned task is closed by loop 1).
			for (const page of openPages) {
				const mine = ownedByUser(page, board);
				const todoistId = page.externalId
					? todoistIdFromExternalId(page.externalId)
					: null;
				if (!todoistId) {
					if (page.name && mine) {
						if (apply) await pushPageToTodoist(notion, board, page);
						summary.createdInTodoist++;
					}
					continue;
				}
				if (activeById.has(todoistId)) continue; // handled above
				if (!mine) continue;
				const task = await todoist.getTask(todoistId);
				if (task?.checked) {
					if (apply) {
						await updateNotionTask(notion, board, page.pageId, {
							status: board.status.done,
						});
					}
					summary.completedInNotion++;
				} else if ((!task || task.is_deleted) && board.status.cancelled) {
					if (apply) {
						await updateNotionTask(notion, board, page.pageId, {
							status: board.status.cancelled,
						});
					}
					summary.cancelledInNotion++;
				}
			}

			// Roll "Today" tasks forward: while a page stays in the today
			// status, keep its Date (and Todoist due) pinned to today. Recurring
			// tasks are skipped — Todoist owns their date.
			if (board.status.today) {
				const today = todayLocal();
				for (const page of openPages) {
					if (page.status !== board.status.today) continue;
					if (!ownedByUser(page, board)) continue;
					if (localWhenDate(page.when) === today) continue;
					const todoistId = page.externalId
						? todoistIdFromExternalId(page.externalId)
						: null;
					const liveTask = todoistId ? activeById.get(todoistId) : undefined;
					if (liveTask?.due?.is_recurring) continue;
					if (apply) {
						await updateNotionTask(notion, board, page.pageId, {
							when: { start: today },
						});
						if (todoistId && liveTask) {
							await todoist.updateTask(todoistId, { dueDate: today });
						}
					}
					summary.rolledToday++;
				}
			}

			// Attachment backstop: reconcile files for each linked, owned page.
			if (board.prop.attachments) {
				for (const page of linkedPages) {
					const todoistId = page.externalId
						? todoistIdFromExternalId(page.externalId)
						: null;
					if (!todoistId || !ownedByUser(page, board)) continue;
					const att = await reconcileAttachments(
						notion,
						todoist,
						board,
						page,
						todoistId,
						apply,
					);
					summary.attachmentsToNotion += att.toNotion;
					summary.attachmentsToTodoist += att.toTodoist;
					summary.attachmentsDeletedNotion += att.deletedNotion;
					summary.attachmentsDeletedTodoist += att.deletedTodoist;
				}
			}
		}

		return { applied: apply, ...summary };
	},
});
