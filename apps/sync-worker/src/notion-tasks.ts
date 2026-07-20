/**
 * Accessors for a board's task database via the Notion public API
 * (@notionhq/client v5: data-source queries, data_source_id parents).
 * Every function takes the {@link Board} it operates on, so the same code
 * serves the personal and apartment databases.
 */

import type { Client } from "@notionhq/client";
import { type Board, TODOIST_ID_PREFIX, boardForDataSource } from "./config.js";

/** A task page parsed into plain values. */
export interface ParsedTask {
	pageId: string;
	/** Data source the page lives in (identifies its board). */
	parentDataSourceId: string | null;
	name: string;
	status: string | null;
	when: string | null;
	notes: string;
	externalId: string | null;
	priority: string | null;
	labels: string[];
	/** People (user ids) in the board's owner property; empty when none. */
	owner: string[];
	/** Files in the board's attachments property; empty when none/unconfigured. */
	attachments: Array<{ name: string; kind: "file" | "external"; url: string }>;
	/** Raw JSON of the attachment sync manifest ("" when none/unconfigured). */
	syncManifest: string;
	lastEditedTime: string;
	lastEditedBy: string | null;
}

/** The subset of fields this worker writes to a task page. */
export interface TaskFields {
	name?: string;
	status?: string;
	/** Wall-clock start plus IANA timezone (Notion renders it correctly). */
	when?: { start: string; timeZone?: string } | null;
	notes?: string;
	externalId?: string;
	/** Select option name; null clears the selection. */
	priority?: string | null;
	labels?: string[];
	/** People user ids; empty array clears. Ignored if the board has no owner. */
	owner?: string[];
}

export function isClosedStatus(status: string | null, board: Board): boolean {
	return status === board.status.done || status === board.status.cancelled;
}

// ---------------------------------------------------------------------------
// Property parsing (Public API page objects)
// ---------------------------------------------------------------------------

type AnyProps = Record<string, any>;

function plainText(fragments: Array<{ plain_text: string }> | undefined): string {
	return (fragments ?? []).map((f) => f.plain_text).join("");
}

export function parseTask(page: any, board: Board): ParsedTask {
	const props = page.properties as AnyProps;
	const P = board.prop;
	return {
		pageId: page.id as string,
		parentDataSourceId: page.parent?.data_source_id ?? null,
		name: plainText(props[P.name]?.title),
		status: props[P.status]?.status?.name ?? null,
		when: props[P.when]?.date?.start ?? null,
		notes: plainText(props[P.notes]?.rich_text),
		externalId: plainText(props[P.externalId]?.rich_text) || null,
		priority: props[P.priority]?.select?.name ?? null,
		labels: (props[P.labels]?.multi_select ?? []).map(
			(option: { name: string }) => option.name,
		),
		owner: P.owner
			? (props[P.owner]?.people ?? []).map((u: { id: string }) => u.id)
			: [],
		attachments: P.attachments
			? (props[P.attachments]?.files ?? []).map((f: any) => ({
					name: f.name as string,
					kind: f.type as "file" | "external",
					url: (f.type === "file" ? f.file?.url : f.external?.url) as string,
				}))
			: [],
		syncManifest: P.syncManifest
			? plainText(props[P.syncManifest]?.rich_text)
			: "",
		lastEditedTime: page.last_edited_time as string,
		lastEditedBy: page.last_edited_by?.id ?? null,
	};
}

/** The bot user id this integration authenticates as (cached). */
let botUserId: string | null = null;
export async function getBotUserId(notion: Client): Promise<string> {
	if (!botUserId) {
		const me: any = await notion.users.me({});
		botUserId = me.id as string;
	}
	return botUserId;
}

// ---------------------------------------------------------------------------
// Property building
// ---------------------------------------------------------------------------

export function buildProps(fields: TaskFields, board: Board): AnyProps {
	const props: AnyProps = {};
	const P = board.prop;
	if (fields.name !== undefined) {
		props[P.name] = { title: [{ text: { content: fields.name } }] };
	}
	if (fields.status !== undefined) {
		props[P.status] = { status: { name: fields.status } };
	}
	if (fields.when !== undefined) {
		props[P.when] = {
			date: fields.when
				? {
						start: fields.when.start,
						...(fields.when.timeZone
							? { time_zone: fields.when.timeZone }
							: {}),
					}
				: null,
		};
	}
	if (fields.notes !== undefined) {
		props[P.notes] = {
			rich_text: fields.notes ? [{ text: { content: fields.notes } }] : [],
		};
	}
	if (fields.externalId !== undefined) {
		props[P.externalId] = {
			rich_text: [{ text: { content: fields.externalId } }],
		};
	}
	if (fields.priority !== undefined) {
		props[P.priority] = {
			select: fields.priority ? { name: fields.priority } : null,
		};
	}
	if (fields.labels !== undefined) {
		props[P.labels] = {
			multi_select: fields.labels.map((name) => ({ name })),
		};
	}
	if (fields.owner !== undefined && P.owner) {
		props[P.owner] = { people: fields.owner.map((id) => ({ id })) };
	}
	return props;
}

// ---------------------------------------------------------------------------
// Queries and writes
// ---------------------------------------------------------------------------

async function queryAll(
	notion: Client,
	board: Board,
	filter: unknown,
): Promise<any[]> {
	const pages: any[] = [];
	let cursor: string | undefined;
	do {
		const response: any = await (notion as any).dataSources.query({
			data_source_id: board.dataSourceId,
			filter,
			start_cursor: cursor,
			page_size: 100,
		});
		pages.push(...response.results);
		cursor = response.has_more ? response.next_cursor : undefined;
	} while (cursor);
	return pages;
}

/** Find the page mapped to an External ID value (e.g. "todoist:<id>"). */
export async function findByExternalId(
	notion: Client,
	board: Board,
	externalId: string,
): Promise<ParsedTask | null> {
	const pages = await queryAll(notion, board, {
		property: board.prop.externalId,
		rich_text: { equals: externalId },
	});
	return pages.length > 0 ? parseTask(pages[0], board) : null;
}

/**
 * Find the page mapped to an External ID across all boards, returning the
 * page and the board it lives in. Used to detect Todoist project moves so a
 * task that already exists in one database is not duplicated into another.
 */
export async function findByExternalIdAnyBoard(
	notion: Client,
	boards: Board[],
	externalId: string,
): Promise<{ page: ParsedTask; board: Board } | null> {
	for (const board of boards) {
		const page = await findByExternalId(notion, board, externalId);
		if (page) return { page, board };
	}
	return null;
}

/**
 * Find an open task by exact name with no External ID yet. Used to adopt
 * a page when Todoist's item:added webhook races our own write-back.
 */
export async function findUnlinkedByName(
	notion: Client,
	board: Board,
	name: string,
): Promise<ParsedTask | null> {
	const pages = await queryAll(notion, board, {
		and: [
			{ property: board.prop.name, title: { equals: name } },
			{ property: board.prop.externalId, rich_text: { is_empty: true } },
		],
	});
	return pages.length > 0 ? parseTask(pages[0], board) : null;
}

/** All pages already linked to Todoist (any status). */
export async function listLinkedTasks(
	notion: Client,
	board: Board,
): Promise<ParsedTask[]> {
	const pages = await queryAll(notion, board, {
		property: board.prop.externalId,
		rich_text: { starts_with: TODOIST_ID_PREFIX },
	});
	return pages.map((page) => parseTask(page, board));
}

/** All open (not Done/Cancelled) tasks. */
export async function listOpenTasks(
	notion: Client,
	board: Board,
): Promise<ParsedTask[]> {
	const and: unknown[] = [
		{
			property: board.prop.status,
			status: { does_not_equal: board.status.done },
		},
	];
	// Only boards with a "won't do" state (e.g. personal) filter it out; the
	// apartment board has none, and an undefined value fails filter validation.
	if (board.status.cancelled) {
		and.push({
			property: board.prop.status,
			status: { does_not_equal: board.status.cancelled },
		});
	}
	const pages = await queryAll(notion, board, { and });
	return pages.map((page) => parseTask(page, board));
}

/** Retrieve a page and the board it belongs to (resolved from its parent). */
export async function getTask(
	notion: Client,
	pageId: string,
): Promise<{ page: ParsedTask; board: Board }> {
	const raw: any = await notion.pages.retrieve({ page_id: pageId });
	const board = boardForDataSource(raw.parent?.data_source_id ?? null);
	return { page: parseTask(raw, board), board };
}

export async function createTask(
	notion: Client,
	board: Board,
	fields: TaskFields,
): Promise<string> {
	const page: any = await notion.pages.create({
		parent: {
			type: "data_source_id",
			data_source_id: board.dataSourceId,
		} as any,
		properties: buildProps(fields, board),
	});
	return page.id as string;
}

export async function updateTask(
	notion: Client,
	board: Board,
	pageId: string,
	fields: TaskFields,
): Promise<void> {
	const props = buildProps(fields, board);
	if (Object.keys(props).length === 0) return;
	await notion.pages.update({ page_id: pageId, properties: props });
}
