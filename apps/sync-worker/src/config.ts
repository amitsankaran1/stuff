/**
 * Central configuration: environment access plus the names of the
 * properties and status options in the Personal Tasks database.
 *
 * If the database schema changes, this is the only file to update.
 * Live schema (data source db47677d-7c3d-4d37-b87b-f6fcde061f3d):
 * Task (title), Status (status), Date (date), Notes (rich_text),
 * External ID (rich_text), Assignee (people).
 */

export function env(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

/** Property names in the Personal Tasks database. */
export const PROP = {
	name: "Task",
	status: "Status",
	when: "Date",
	notes: "Notes",
	externalId: "External ID",
} as const;

/**
 * Status option names in the Personal Tasks database.
 *
 * The database has its own automation rules ("Status = Inbox → Clear
 * Date", "Future Date → Status = Upcoming"), so inbound tasks must land
 * in a status consistent with them: dated tasks are Upcoming, undated
 * tasks are Inbox. Landing a dated task in Inbox gets its date wiped.
 */
export const STATUS = {
	inbox: "Inbox",
	upcoming: "Upcoming",
	done: "Done",
	cancelled: "Cancelled",
} as const;

/** Where an open (or reopened) Todoist task belongs, given its due. */
export function openStatusFor(hasDue: boolean): string {
	return hasDue ? STATUS.upcoming : STATUS.inbox;
}

/**
 * Todoist project ids whose tasks are never synced (comma-separated in
 * TODOIST_EXCLUDED_PROJECT_IDS) — e.g. the "Getting Started 👋"
 * onboarding project.
 */
export function excludedTodoistProjectIds(): Set<string> {
	const raw = process.env.TODOIST_EXCLUDED_PROJECT_IDS ?? "";
	return new Set(
		raw
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean),
	);
}

/** Namespaced External ID prefix mapping a page to a Todoist task. */
export const TODOIST_ID_PREFIX = "todoist:";

export function todoistExternalId(taskId: string): string {
	return `${TODOIST_ID_PREFIX}${taskId}`;
}

/** Extract the Todoist task id from an External ID value, if present. */
export function todoistIdFromExternalId(externalId: string): string | null {
	return externalId.startsWith(TODOIST_ID_PREFIX)
		? externalId.slice(TODOIST_ID_PREFIX.length)
		: null;
}
