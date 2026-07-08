/**
 * Accessors for the Personal Tasks database via the Notion public API
 * (@notionhq/client v5: data-source queries, data_source_id parents).
 */

import type { Client } from "@notionhq/client";
import { PROP, STATUS, env } from "./config.js";

/** A Personal Tasks page parsed into plain values. */
export interface ParsedTask {
	pageId: string;
	name: string;
	status: string | null;
	when: string | null;
	notes: string;
	externalId: string | null;
	lastEditedTime: string;
	lastEditedBy: string | null;
}

/** The subset of fields this worker writes to a Personal Tasks page. */
export interface TaskFields {
	name?: string;
	status?: string;
	/** Wall-clock start plus IANA timezone (Notion renders it correctly). */
	when?: { start: string; timeZone?: string } | null;
	notes?: string;
	externalId?: string;
}

export function isClosedStatus(status: string | null): boolean {
	return status === STATUS.done || status === STATUS.cancelled;
}

// ---------------------------------------------------------------------------
// Property parsing (Public API page objects)
// ---------------------------------------------------------------------------

type AnyProps = Record<string, any>;

function plainText(fragments: Array<{ plain_text: string }> | undefined): string {
	return (fragments ?? []).map((f) => f.plain_text).join("");
}

export function parseTask(page: any): ParsedTask {
	const props = page.properties as AnyProps;
	return {
		pageId: page.id as string,
		name: plainText(props[PROP.name]?.title),
		status: props[PROP.status]?.status?.name ?? null,
		when: props[PROP.when]?.date?.start ?? null,
		notes: plainText(props[PROP.notes]?.rich_text),
		externalId: plainText(props[PROP.externalId]?.rich_text) || null,
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

export function buildProps(fields: TaskFields): AnyProps {
	const props: AnyProps = {};
	if (fields.name !== undefined) {
		props[PROP.name] = { title: [{ text: { content: fields.name } }] };
	}
	if (fields.status !== undefined) {
		props[PROP.status] = { status: { name: fields.status } };
	}
	if (fields.when !== undefined) {
		props[PROP.when] = {
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
		props[PROP.notes] = {
			rich_text: fields.notes ? [{ text: { content: fields.notes } }] : [],
		};
	}
	if (fields.externalId !== undefined) {
		props[PROP.externalId] = {
			rich_text: [{ text: { content: fields.externalId } }],
		};
	}
	return props;
}

// ---------------------------------------------------------------------------
// Queries and writes
// ---------------------------------------------------------------------------

function dataSourceId(): string {
	// Not NOTION_-prefixed: that prefix is reserved by the workers runtime.
	return env("STUFF_TASKS_DATA_SOURCE_ID");
}

async function queryAll(notion: Client, filter: unknown): Promise<any[]> {
	const pages: any[] = [];
	let cursor: string | undefined;
	do {
		const response: any = await (notion as any).dataSources.query({
			data_source_id: dataSourceId(),
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
	externalId: string,
): Promise<ParsedTask | null> {
	const pages = await queryAll(notion, {
		property: PROP.externalId,
		rich_text: { equals: externalId },
	});
	return pages.length > 0 ? parseTask(pages[0]) : null;
}

/**
 * Find an open task by exact name with no External ID yet. Used to adopt
 * a page when Todoist's item:added webhook races our own write-back.
 */
export async function findUnlinkedByName(
	notion: Client,
	name: string,
): Promise<ParsedTask | null> {
	const pages = await queryAll(notion, {
		and: [
			{ property: PROP.name, title: { equals: name } },
			{ property: PROP.externalId, rich_text: { is_empty: true } },
		],
	});
	return pages.length > 0 ? parseTask(pages[0]) : null;
}

/** All pages already linked to Todoist (any status). */
export async function listLinkedTasks(notion: Client): Promise<ParsedTask[]> {
	const pages = await queryAll(notion, {
		property: PROP.externalId,
		rich_text: { starts_with: "todoist:" },
	});
	return pages.map(parseTask);
}

/** All open (not Done/Cancelled) tasks. */
export async function listOpenTasks(notion: Client): Promise<ParsedTask[]> {
	const pages = await queryAll(notion, {
		and: [
			{ property: PROP.status, status: { does_not_equal: STATUS.done } },
			{ property: PROP.status, status: { does_not_equal: STATUS.cancelled } },
		],
	});
	return pages.map(parseTask);
}

export async function getTask(
	notion: Client,
	pageId: string,
): Promise<ParsedTask> {
	const page = await notion.pages.retrieve({ page_id: pageId });
	return parseTask(page);
}

export async function createTask(
	notion: Client,
	fields: TaskFields,
): Promise<string> {
	const page: any = await notion.pages.create({
		parent: { type: "data_source_id", data_source_id: dataSourceId() } as any,
		properties: buildProps(fields),
	});
	return page.id as string;
}

export async function updateTask(
	notion: Client,
	pageId: string,
	fields: TaskFields,
): Promise<void> {
	const props = buildProps(fields);
	if (Object.keys(props).length === 0) return;
	await notion.pages.update({ page_id: pageId, properties: props });
}
