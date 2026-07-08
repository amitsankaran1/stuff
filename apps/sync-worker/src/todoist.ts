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
}
