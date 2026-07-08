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
	STATUS,
	env,
	excludedTodoistProjectIds,
	openStatusFor,
	todoistExternalId,
	todoistIdFromExternalId,
} from "./config.js";
import {
	notionUpdateFor,
	notionToTodoistFields,
	todoistToNotionFields,
	todoistUpdateFor,
} from "./mapping.js";
import {
	createTask as createNotionTask,
	findByExternalId,
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
	task: TodoistTask,
): Promise<"created" | "updated" | "unchanged"> {
	const externalId = todoistExternalId(task.id);
	let page = await findByExternalId(notion, externalId);

	if (!page) {
		// If our own outbound create raced this webhook, the page exists but
		// its External ID write may not have landed yet — adopt by name.
		const unlinked = await findUnlinkedByName(notion, task.content);
		if (unlinked) {
			await updateNotionTask(notion, unlinked.pageId, { externalId });
			page = { ...unlinked, externalId };
		}
	}

	if (!page) {
		await createNotionTask(notion, {
			...todoistToNotionFields(task),
			status: task.checked
				? STATUS.done
				: openStatusFor(Boolean(task.due)),
			externalId,
		});
		return "created";
	}

	const update = notionUpdateFor(task, page);
	if (update) {
		await updateNotionTask(notion, page.pageId, update);
		return "updated";
	}
	return "unchanged";
}

worker.webhook("todoist", {
	title: "Todoist events",
	description:
		"Receives Todoist item webhooks and mirrors them into the Stuff Tasks database.",
	execute: async (events, context) => {
		const notion = getNotion(context);
		for (const event of events) {
			verifyTodoistSignature(event.rawBody, event.headers);
			const payload = event.body as unknown as TodoistWebhookPayload;
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
					const result = live
						? await upsertFromTodoist(notion, live)
						: "gone";
					console.log(`${payload.event_name} ${task.id}: ${result}`);
					break;
				}
				case "item:deleted": {
					const page = await findByExternalId(
						notion,
						todoistExternalId(task.id),
					);
					if (page && !isClosedStatus(page.status)) {
						await updateNotionTask(notion, page.pageId, {
							status: STATUS.cancelled,
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

/** Push one Notion page's state to Todoist (create, update, close, reopen). */
async function pushPageToTodoist(
	notion: Client,
	page: ParsedTask,
): Promise<string> {
	const todoistId = page.externalId
		? todoistIdFromExternalId(page.externalId)
		: null;

	if (!todoistId) {
		// Never linked. Only open tasks are worth creating in Todoist.
		if (isClosedStatus(page.status) || !page.name) return "skipped";
		const created = await todoist.createTask(notionToTodoistFields(page));
		await updateNotionTask(notion, page.pageId, {
			externalId: todoistExternalId(created.id),
		});
		return "created";
	}

	const task = await todoist.getTask(todoistId);
	if (!task) return "missing-in-todoist";

	const actions: string[] = [];
	const update = todoistUpdateFor(page, task);
	if (update) {
		await todoist.updateTask(todoistId, update);
		actions.push("updated");
	}

	const pageClosed = isClosedStatus(page.status);
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
			// time we run, and echoes must diff against current state.
			const page = await getNotionTask(notion, pageId);
			// Echo guard: if the last edit was made by this integration,
			// the automation fired on our own inbound write — pushing it
			// back out could clear fields mid-settle. Skip; the reconcile
			// tool covers anything genuinely missed.
			if (page.lastEditedBy === (await getBotUserId(notion))) {
				console.log(`notionPush ${pageId}: skipped (own write echo)`);
				continue;
			}
			const result = await pushPageToTodoist(notion, page);
			console.log(`notionPush ${pageId}: ${result}`);
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
		const notion = getNotion(context);
		const summary = {
			createdInNotion: 0,
			createdInTodoist: 0,
			updatedInNotion: 0,
			updatedInTodoist: 0,
			closedInTodoist: 0,
			completedInNotion: 0,
			cancelledInNotion: 0,
		};

		const excluded = excludedTodoistProjectIds();
		const [allActiveTasks, linkedPages, openPages] = await Promise.all([
			todoist.listActiveTasks(),
			listLinkedTasks(notion),
			listOpenTasks(notion),
		]);
		const activeTasks = allActiveTasks.filter(
			(task) => !task.project_id || !excluded.has(task.project_id),
		);
		const pagesByTodoistId = new Map<string, ParsedTask>();
		for (const page of linkedPages) {
			const id = page.externalId
				? todoistIdFromExternalId(page.externalId)
				: null;
			if (id) pagesByTodoistId.set(id, page);
		}
		const activeById = new Map(activeTasks.map((task) => [task.id, task]));

		// 1. Active in Todoist, missing or drifted in Notion (Todoist wins).
		for (const task of activeTasks) {
			const page = pagesByTodoistId.get(task.id);
			if (!page) {
				if (apply) await upsertFromTodoist(notion, task);
				summary.createdInNotion++;
			} else if (isClosedStatus(page.status)) {
				// Notion says done/cancelled but Todoist still has it active.
				if (apply) await todoist.closeTask(task.id);
				summary.closedInTodoist++;
			} else {
				const update = notionUpdateFor(task, page);
				if (update) {
					if (apply) await updateNotionTask(notion, page.pageId, update);
					summary.updatedInNotion++;
				}
			}
		}

		// 2. Open in Notion: unlinked pages get created in Todoist; linked
		//    pages missing from the active list were completed or deleted.
		for (const page of openPages) {
			const todoistId = page.externalId
				? todoistIdFromExternalId(page.externalId)
				: null;
			if (!todoistId) {
				if (page.name) {
					if (apply) await pushPageToTodoist(notion, page);
					summary.createdInTodoist++;
				}
				continue;
			}
			if (activeById.has(todoistId)) continue; // handled above
			const task = await todoist.getTask(todoistId);
			if (task?.checked) {
				if (apply) {
					await updateNotionTask(notion, page.pageId, {
						status: STATUS.done,
					});
				}
				summary.completedInNotion++;
			} else if (!task || task.is_deleted) {
				if (apply) {
					await updateNotionTask(notion, page.pageId, {
						status: STATUS.cancelled,
					});
				}
				summary.cancelledInNotion++;
			}
		}

		return { applied: apply, ...summary };
	},
});
