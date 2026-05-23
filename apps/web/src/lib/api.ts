import type { Task } from '@stuff/shared';
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

export const tasksQueryKey = (view: ViewKey) => ['tasks', view] as const;
