/**
 * Minimal Todoist API v1 client (https://developer.todoist.com/api/v1/).
 * Uses fetch directly; every call goes through the worker's pacer.
 */

import { env } from "./config.js";

const BASE_URL = "https://api.todoist.com/api/v1";

export interface TodoistDue {
	date: string; // "2026-07-08", "2026-07-08T10:00:00", or UTC "...Z"
	timezone?: string | null;
	string?: string;
	is_recurring?: boolean;
}

export interface TodoistDeadline {
	date: string;
}

export interface TodoistTask {
	id: string;
	content: string;
	description: string;
	priority: number; // 1 (normal) .. 4 (urgent)
	labels: string[];
	project_id: string | null;
	due: TodoistDue | null;
	deadline: TodoistDeadline | null;
	checked: boolean;
	completed_at: string | null;
	is_deleted?: boolean;
	updated_at?: string;
}

/** Fields this worker writes to Todoist. */
export interface TodoistTaskFields {
	content?: string;
	description?: string;
	/** ISO date or datetime; null clears the due date. */
	dueDate?: string | null;
	/** 1 (none) .. 4 (urgent). */
	priority?: number;
	/** Full label set (names); replaces the task's labels. */
	labels?: string[];
	/** Project to create the task in; only honored on create. */
	projectId?: string;
}

/** A file attached to a Todoist comment. */
export interface TodoistFileAttachment {
	resource_type?: string;
	file_name: string;
	file_url: string;
	file_type?: string; // MIME type
	file_size?: number;
	upload_state?: string;
}

/** A Todoist task comment (note). */
export interface TodoistComment {
	id: string;
	/** Present on note webhook payloads; the task the note belongs to. */
	item_id?: string;
	content: string;
	posted_at?: string;
	file_attachment: TodoistFileAttachment | null;
}

type Wait = () => Promise<void>;

function buildBody(fields: TodoistTaskFields): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (fields.content !== undefined) body.content = fields.content;
	if (fields.description !== undefined) body.description = fields.description;
	if (fields.dueDate !== undefined) {
		if (fields.dueDate === null) {
			// Documented way to remove a due date.
			body.due_string = "no due date";
		} else if (fields.dueDate.includes("T")) {
			body.due_datetime = fields.dueDate;
		} else {
			body.due_date = fields.dueDate;
		}
	}
	if (fields.priority !== undefined) body.priority = fields.priority;
	if (fields.labels !== undefined) body.labels = fields.labels;
	if (fields.projectId !== undefined) body.project_id = fields.projectId;
	return body;
}

export class TodoistClient {
	readonly #wait: Wait;

	constructor(wait: Wait) {
		this.#wait = wait;
	}

	async #request(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<Response> {
		await this.#wait();
		const response = await fetch(`${BASE_URL}${path}`, {
			method,
			headers: {
				// Read lazily: the module is imported for capability
				// discovery before environment variables are configured.
				Authorization: `Bearer ${env("TODOIST_API_TOKEN")}`,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		if (!response.ok && response.status !== 404) {
			const text = await response.text();
			throw new Error(
				`Todoist ${method} ${path} failed: ${response.status} ${text}`,
			);
		}
		return response;
	}

	/** Returns null when the task does not exist (deleted). */
	async getTask(id: string): Promise<TodoistTask | null> {
		const response = await this.#request("GET", `/tasks/${id}`);
		if (response.status === 404) return null;
		return (await response.json()) as TodoistTask;
	}

	/** All active (uncompleted) tasks, following cursor pagination. */
	async listActiveTasks(): Promise<TodoistTask[]> {
		const tasks: TodoistTask[] = [];
		let cursor: string | null = null;
		do {
			const query: string = cursor
				? `?limit=200&cursor=${encodeURIComponent(cursor)}`
				: "?limit=200";
			const response = await this.#request("GET", `/tasks${query}`);
			const page = (await response.json()) as {
				results: TodoistTask[];
				next_cursor: string | null;
			};
			tasks.push(...page.results);
			cursor = page.next_cursor;
		} while (cursor);
		return tasks;
	}

	async createTask(fields: TodoistTaskFields): Promise<TodoistTask> {
		const response = await this.#request("POST", "/tasks", buildBody(fields));
		return (await response.json()) as TodoistTask;
	}

	async updateTask(id: string, fields: TodoistTaskFields): Promise<void> {
		await this.#request("POST", `/tasks/${id}`, buildBody(fields));
	}

	async closeTask(id: string): Promise<void> {
		await this.#request("POST", `/tasks/${id}/close`);
	}

	async reopenTask(id: string): Promise<void> {
		await this.#request("POST", `/tasks/${id}/reopen`);
	}

	/**
	 * The account's configured IANA timezone (e.g. "America/Los_Angeles"),
	 * or null if unavailable. Read from the Sync API's user resource so the
	 * worker's notion of "today" tracks whatever zone Todoist itself resolves
	 * due dates in. The /sync endpoint expects form-encoded params, not JSON.
	 */
	async getTimeZone(): Promise<string | null> {
		await this.#wait();
		const response = await fetch(`${BASE_URL}/sync`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env("TODOIST_API_TOKEN")}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				sync_token: "*",
				resource_types: '["user"]',
			}),
		});
		if (!response.ok) {
			throw new Error(`Todoist POST /sync failed: ${response.status}`);
		}
		const data = (await response.json()) as {
			user?: { timezone?: string; tz_info?: { timezone?: string } };
		};
		return data.user?.tz_info?.timezone ?? data.user?.timezone ?? null;
	}

	// -------------------------------------------------------------------------
	// Comments & file attachments
	// -------------------------------------------------------------------------

	/** POST a multipart/form-data body (uploads); no JSON Content-Type. */
	async #requestForm(path: string, form: FormData): Promise<Response> {
		await this.#wait();
		const response = await fetch(`${BASE_URL}${path}`, {
			method: "POST",
			// Do not set Content-Type: the runtime adds the multipart boundary.
			headers: { Authorization: `Bearer ${env("TODOIST_API_TOKEN")}` },
			body: form,
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Todoist POST ${path} failed: ${response.status} ${text}`);
		}
		return response;
	}

	/** GET raw bytes. Sends the bearer only for Todoist-hosted URLs. */
	async #requestBinary(url: string, sendAuth: boolean): Promise<Response> {
		await this.#wait();
		const response = await fetch(url, {
			headers: sendAuth
				? { Authorization: `Bearer ${env("TODOIST_API_TOKEN")}` }
				: {},
		});
		if (!response.ok) {
			throw new Error(`Todoist GET ${url} failed: ${response.status}`);
		}
		return response;
	}

	/** All comments on a task, following cursor pagination. */
	async listComments(taskId: string): Promise<TodoistComment[]> {
		const comments: TodoistComment[] = [];
		let cursor: string | null = null;
		do {
			const query = cursor
				? `?task_id=${taskId}&limit=200&cursor=${encodeURIComponent(cursor)}`
				: `?task_id=${taskId}&limit=200`;
			const response = await this.#request("GET", `/comments${query}`);
			const body = (await response.json()) as
				| { results: TodoistComment[]; next_cursor: string | null }
				| TodoistComment[];
			if (Array.isArray(body)) {
				comments.push(...body);
				cursor = null;
			} else {
				comments.push(...body.results);
				cursor = body.next_cursor;
			}
		} while (cursor);
		return comments;
	}

	/** Upload a file, returning the attachment object to attach to a comment. */
	async uploadFile(
		fileName: string,
		contentType: string | undefined,
		data: Blob,
	): Promise<TodoistFileAttachment> {
		const form = new FormData();
		form.append("file_name", fileName);
		form.append(
			"file",
			contentType ? new Blob([data], { type: contentType }) : data,
			fileName,
		);
		const response = await this.#requestForm("/uploads", form);
		return (await response.json()) as TodoistFileAttachment;
	}

	/** Create a comment carrying a file attachment. */
	async createComment(
		taskId: string,
		content: string,
		attachment: TodoistFileAttachment,
	): Promise<TodoistComment> {
		const response = await this.#request("POST", "/comments", {
			task_id: taskId,
			content,
			attachment,
		});
		return (await response.json()) as TodoistComment;
	}

	async deleteComment(commentId: string): Promise<void> {
		await this.#request("DELETE", `/comments/${commentId}`);
	}

	/** Download a Todoist-hosted attachment's bytes. */
	async downloadAttachment(fileUrl: string): Promise<Blob> {
		const response = await this.#requestBinary(fileUrl, true);
		return await response.blob();
	}
}
