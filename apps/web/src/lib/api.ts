import type { Task, TaskCreate, TaskUpdate } from '@stuff/shared';
import type { ViewKey } from './views';

export interface TasksResponse {
  view: ViewKey;
  count: number;
  tasks: Task[];
}

export async function fetchTasks(view: ViewKey): Promise<TasksResponse> {
  const res = await fetch(`/api/tasks?view=${encodeURIComponent(view)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`fetchTasks(${view}) failed: ${res.status}`);
  return (await res.json()) as TasksResponse;
}

export async function createTask(input: TaskCreate): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`createTask failed: ${res.status}`);
  const data = (await res.json()) as { task: Task };
  return data.task;
}

export async function updateTask(id: string, input: Omit<TaskUpdate, 'id'>): Promise<Task> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`updateTask(${id}) failed: ${res.status}`);
  const data = (await res.json()) as { task: Task };
  return data.task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`deleteTask(${id}) failed: ${res.status}`);
}

export const tasksQueryKey = (view: ViewKey) => ['tasks', view] as const;
export const taskQueryKey = (id: string) => ['task', id] as const;
