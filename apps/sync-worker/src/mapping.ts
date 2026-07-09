/**
 * Field mapping between Todoist tasks and Personal Tasks pages, plus the
 * diff helpers that implement echo suppression: every sync computes the
 * target state and writes only what differs, so a change echoing back
 * around the loop converges to a no-op instead of ping-ponging.
 *
 * Mapped fields: content ↔ Task, due ↔ Date, description ↔ Notes,
 * checked ↔ Status (Done). Deletion in Todoist maps to Status Cancelled.
 */

import {
	STATUS,
	notionPriorityFor,
	openStatusFor,
	todoistPriorityFor,
} from "./config.js";
import type { ParsedTask, TaskFields } from "./notion-tasks.js";
import type { TodoistTask, TodoistTaskFields } from "./todoist.js";

/**
 * Compare date values as instants, not strings: Todoist reports UTC
 * ("2026-07-07T22:15:00Z") while Notion echoes local offsets
 * ("2026-07-07T18:15:00.000-04:00") for the same moment. Date-only
 * values compare as calendar dates.
 */
function sameDate(a: string | null, b: string | null): boolean {
	if (a === null || b === null) return a === b;
	const aHasTime = a.includes("T");
	if (aHasTime !== b.includes("T")) return false;
	if (!aHasTime) return a === b;
	return Date.parse(a) === Date.parse(b);
}

/**
 * Convert a UTC instant to the wall-clock time in a timezone, formatted
 * for Notion's `date.start` (which must carry no offset when a
 * `time_zone` is provided alongside it).
 */
function wallTime(utcIso: string, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(utcIso));
	const get = (type: string) =>
		parts.find((part) => part.type === type)?.value ?? "00";
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Notion date value for a Todoist due/none, preserving the timezone. */
export function notionDateFromDue(
	due: { date: string; timezone?: string | null } | null,
): { start: string; timeZone?: string } | null {
	if (!due) return null;
	if (!due.date.includes("T")) return { start: due.date };
	if (due.timezone) {
		return { start: wallTime(due.date, due.timezone), timeZone: due.timezone };
	}
	return { start: due.date }; // floating time
}

// ---------------------------------------------------------------------------
// Todoist → Notion
// ---------------------------------------------------------------------------

/** Compare two label sets order-insensitively. */
function sameLabels(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((label) => set.has(label));
}

/** The Notion field values a Todoist task implies (content fields only). */
export function todoistToNotionFields(task: TodoistTask): TaskFields {
	return {
		name: task.content,
		when: notionDateFromDue(task.due),
		notes: task.description ?? "",
		priority: notionPriorityFor(task.priority),
		labels: task.labels,
	};
}

/**
 * Diff a Todoist task against its Notion page. Returns only the fields
 * that need writing, or null when the page already matches.
 */
export function notionUpdateFor(
	task: TodoistTask,
	page: ParsedTask,
): TaskFields | null {
	const target = todoistToNotionFields(task);
	const update: TaskFields = {};

	if ((target.name ?? "").trim() !== page.name.trim()) {
		update.name = target.name;
	}
	if (!sameDate(task.due?.date ?? null, page.when)) update.when = target.when;
	if ((target.notes ?? "") !== page.notes) update.notes = target.notes;
	if ((target.priority ?? null) !== page.priority) {
		update.priority = target.priority;
	}
	if (!sameLabels(target.labels ?? [], page.labels)) {
		update.labels = target.labels;
	}

	// Completion state: either side saying "done" must land in Notion,
	// but reopens only pull a page back from Done (never from Cancelled —
	// a cancelled page stays cancelled unless changed in Notion).
	if (task.checked && !isClosed(page.status)) {
		update.status = STATUS.done;
	} else if (!task.checked && page.status === STATUS.done) {
		update.status = openStatusFor(Boolean(task.due));
	} else if (!task.checked && page.status === STATUS.inbox && task.due) {
		// A task sitting in Inbox that gains a due in Todoist must move to
		// Upcoming: the DB automation "Status = Inbox → Clear Date" would
		// otherwise wipe the date we just wrote. Other open states
		// (Anytime/Someday/Today) are deliberate and left untouched.
		update.status = STATUS.upcoming;
	}

	return Object.keys(update).length > 0 ? update : null;
}

function isClosed(status: string | null): boolean {
	return status === STATUS.done || status === STATUS.cancelled;
}

// ---------------------------------------------------------------------------
// Notion → Todoist
// ---------------------------------------------------------------------------

/** The Todoist field values a Notion page implies (content fields only). */
export function notionToTodoistFields(page: ParsedTask): TodoistTaskFields {
	return {
		content: page.name,
		description: page.notes,
		dueDate: page.when,
		priority: todoistPriorityFor(page.priority),
		labels: page.labels,
	};
}

/**
 * Diff a Notion page against its Todoist task. Returns only the fields
 * that need writing, or null when the task already matches.
 */
export function todoistUpdateFor(
	page: ParsedTask,
	task: TodoistTask,
): TodoistTaskFields | null {
	const update: TodoistTaskFields = {};

	const name = page.name.trim();
	if (name && name !== task.content.trim()) update.content = name;
	if (page.notes !== (task.description ?? "")) update.description = page.notes;
	const priority = todoistPriorityFor(page.priority);
	if (priority !== task.priority) update.priority = priority;
	if (!sameLabels(page.labels, task.labels)) update.labels = page.labels;
	// Never push dates onto a recurring task: updating `due_date` clears
	// Todoist's recurrence rule (verified). The rule lives in Todoist;
	// inbound sync re-asserts Todoist's date onto the page instead.
	if (
		!task.due?.is_recurring &&
		!sameDate(page.when, task.due?.date ?? null)
	) {
		update.dueDate = page.when;
	}

	return Object.keys(update).length > 0 ? update : null;
}
