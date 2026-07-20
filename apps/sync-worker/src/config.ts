/**
 * Central configuration: environment access, the Todoist-side helpers that
 * are shared across every synced database, and the `Board` registry that
 * describes each (Notion data source ⇄ Todoist project) pair we sync.
 *
 * A Board captures everything that differs between databases: its data
 * source, the Todoist project its tasks live in, the property names, the
 * status model, which DB automations exist, and an optional owner filter.
 * The personal board reproduces the original single-database behavior.
 *
 * Personal Tasks (data source db47677d-7c3d-4d37-b87b-f6fcde061f3d):
 *   Task (title), Status (status), Date (date), Notes (rich_text),
 *   External ID (rich_text), Assignee (people), Priority (select),
 *   Labels (multi_select).
 */

export function env(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

// ---------------------------------------------------------------------------
// Priority (shared: Todoist priority ints ⇄ Notion P1–P3 select)
// ---------------------------------------------------------------------------

/**
 * Priority mapping. Todoist uses ints 1–4 where 1 is the default "no
 * priority" and 4 is urgent (P1 in the UI); Notion uses a select whose
 * options are P1–P3. Todoist's default (1) maps to no Notion selection.
 */
export function notionPriorityFor(todoistPriority: number): string | null {
	switch (todoistPriority) {
		case 4:
			return "P1";
		case 3:
			return "P2";
		case 2:
			return "P3";
		default:
			return null;
	}
}

/** Inverse of {@link notionPriorityFor}; a blank Notion priority is 1. */
export function todoistPriorityFor(notionPriority: string | null): number {
	switch (notionPriority) {
		case "P1":
			return 4;
		case "P2":
			return 3;
		case "P3":
			return 2;
		default:
			return 1;
	}
}

// ---------------------------------------------------------------------------
// External ID (shared: the pairing key stored on every synced page)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

/** Notion property names for a board's task database. */
export interface BoardProps {
	name: string;
	status: string;
	when: string;
	notes: string;
	externalId: string;
	priority: string;
	labels: string;
	/** People property to filter/attribute by; only set for shared boards. */
	owner?: string;
	/** Files & media property that mirrors a task's file attachments. */
	attachments?: string;
	/** Hidden rich_text property holding the attachment sync manifest (JSON). */
	syncManifest?: string;
}

/** A board's status model. */
export interface BoardStatus {
	done: string;
	/**
	 * Terminal "won't do" status a Todoist delete maps to. Optional: a board
	 * without one ignores Todoist deletes (the page is left untouched). Both
	 * boards currently define "Won't Do".
	 */
	cancelled?: string;
	/**
	 * Where an open (or reopened) task belongs, given its due localized to a
	 * calendar date (YYYY-MM-DD, or null when undated).
	 */
	openFor(dueLocalDate: string | null): string;
	/**
	 * The status whose DB automation clears the date ("Inbox" on personal).
	 * Only meaningful when {@link Board.automations.inboxClearsDate} is true.
	 */
	inbox?: string;
	/**
	 * The status meaning "due today". When set, the worker keeps such tasks'
	 * Date (and Todoist due) pinned to today, and maps a due-today task to it.
	 */
	today?: string;
}

// Resolved from the Todoist account at runtime (see setSyncTimeZone). Keeps
// the worker's "today" aligned with whatever zone Todoist resolves due dates
// in, so a task marked "Today" late in the evening is not misread as future.
let resolvedTimeZone: string | null = null;

/** IANA timezone used to decide what "today" is for the Today↔due coupling. */
export function syncTimeZone(): string {
	return resolvedTimeZone ?? process.env.TIMEZONE ?? "America/New_York";
}

/**
 * Override the timezone with a runtime-resolved value. Invalid or null clears
 * the override so {@link syncTimeZone} falls back to TIMEZONE, then New York.
 */
export function setSyncTimeZone(tz: string | null): void {
	if (tz) {
		try {
			new Intl.DateTimeFormat("en-CA", { timeZone: tz });
			resolvedTimeZone = tz;
			return;
		} catch {
			// Not a valid IANA zone — fall through to clear.
		}
	}
	resolvedTimeZone = null;
}

/** Today's calendar date (YYYY-MM-DD) in {@link syncTimeZone}. */
export function todayLocal(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: syncTimeZone(),
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

/**
 * A synced database: one Notion data source paired with one Todoist project.
 */
export interface Board {
	key: "personal" | "apartment";
	/** Notion data source id (resolved lazily from env). */
	readonly dataSourceId: string;
	/** Todoist project new tasks are created in; null means the default Inbox. */
	readonly todoistProjectId: string | null;
	prop: BoardProps;
	status: BoardStatus;
	automations: { inboxClearsDate: boolean };
	/** When set, only tasks owned by userId (or unowned) sync to Todoist. */
	ownerFilter?: { prop: string; userId: string };
}

/**
 * Personal Tasks — the original database. Its DB automations ("Status =
 * Inbox → Clear Date", "Future Date → Status = Upcoming") mean inbound
 * tasks must land in a status consistent with them: dated → Upcoming,
 * undated → Inbox. Landing a dated task in Inbox gets its date wiped.
 */
const personal: Board = {
	key: "personal",
	get dataSourceId() {
		// Not NOTION_-prefixed: that prefix is reserved by the workers runtime.
		return env("STUFF_TASKS_DATA_SOURCE_ID");
	},
	todoistProjectId: null,
	prop: {
		name: "Task",
		status: "Status",
		when: "Date",
		notes: "Notes",
		externalId: "External ID",
		priority: "Priority",
		labels: "Labels",
		attachments: "Attachments",
		syncManifest: "Sync Manifest",
	},
	status: {
		done: "Done",
		cancelled: "Won't Do",
		inbox: "Inbox",
		today: "Today",
		openFor: (dueLocalDate) => {
			if (!dueLocalDate) return "Inbox";
			// Overdue counts as Today; only a future date is Upcoming (matching
			// the DB's "Future Date → Status = Upcoming" automation). ISO dates
			// are fixed-width, so lexicographic <= is a correct date compare.
			return dueLocalDate <= todayLocal() ? "Today" : "Upcoming";
		},
	},
	automations: { inboxClearsDate: true },
};

/** Notion user id of the person whose apartment tasks sync to Todoist. */
const APARTMENT_OWNER_USER_ID =
	process.env.APARTMENT_OWNER_USER_ID ??
	"9e62ddc2-e27b-4b7f-8ab0-d06e89cd5649";

/**
 * Apartment Tasks — a database shared with a collaborator. It has no DB
 * automations, so open tasks land in "Not started" regardless of due. Only
 * tasks the owner user holds (or unowned tasks) sync to their Todoist, into a
 * dedicated project. Env is read tolerantly: until the data source / project
 * ids are configured, this board is inert and the personal sync is unaffected.
 */
const apartment: Board = {
	key: "apartment",
	get dataSourceId() {
		return process.env.STUFF_APARTMENT_DATA_SOURCE_ID ?? "";
	},
	get todoistProjectId() {
		return process.env.TODOIST_APARTMENT_PROJECT_ID ?? null;
	},
	prop: {
		name: "Task",
		status: "Status",
		when: "Date",
		notes: "Notes",
		externalId: "External ID",
		priority: "Priority",
		labels: "Labels",
		owner: "Owner",
		attachments: "Attachments",
		syncManifest: "Sync Manifest",
	},
	status: {
		done: "Done",
		// A Todoist delete lands here (mirrors personal), so the shared page is
		// marked "Won't Do" rather than silently orphaned when it leaves Todoist.
		cancelled: "Won't Do",
		today: "Today",
		// Mirrors personal: the Date (the day you intend to do a task) buckets
		// it, and marking Today pins that Date to today. Apartment has no Inbox,
		// so undated tasks stay "Not started" instead.
		openFor: (dueLocalDate) => {
			if (!dueLocalDate) return "Not started";
			return dueLocalDate <= todayLocal() ? "Today" : "Upcoming";
		},
	},
	// No Inbox / inbox-clears-date automation on this shared board.
	automations: { inboxClearsDate: false },
	ownerFilter: { prop: "Owner", userId: APARTMENT_OWNER_USER_ID },
};

/** All synced boards. */
export const boards: Board[] = [personal, apartment];

/** Boards fully configured to sync. Used where we must not touch an inert
 * board (e.g. querying its data source). The default board (personal) needs
 * only a data source; any other board also needs its Todoist project set. */
export function activeBoards(): Board[] {
	return boards.filter((b) => {
		if (!b.dataSourceId) return false;
		return b === personal || Boolean(b.todoistProjectId);
	});
}

/** The board a Todoist task belongs to, chosen by its project. */
export function boardForTodoistProject(projectId: string | null): Board {
	if (projectId) {
		const match = boards.find((b) => b.todoistProjectId === projectId);
		if (match) return match;
	}
	return personal;
}

/** The board a Notion page belongs to, chosen by its parent data source. */
export function boardForDataSource(dataSourceId: string | null): Board {
	if (dataSourceId) {
		const match = boards.find((b) => b.dataSourceId === dataSourceId);
		if (match) return match;
	}
	return personal;
}

/**
 * Whether a Todoist task (by its project) belongs to a board. A board with a
 * project owns exactly the tasks in that project; the default board (null
 * project, e.g. Inbox) owns everything not claimed by another board's project.
 */
export function taskBelongsToBoard(
	projectId: string | null,
	board: Board,
): boolean {
	if (board.todoistProjectId) return projectId === board.todoistProjectId;
	return !boards.some(
		(b) => b.todoistProjectId && b.todoistProjectId === projectId,
	);
}
