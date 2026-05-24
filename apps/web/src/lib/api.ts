import type {
  Area,
  ChecklistItem,
  Project,
  Task,
  TaskCreate,
  TaskUpdate,
} from '@stuff/shared';
import type { ViewKey } from './views';

export interface TasksResponse {
  view: ViewKey;
  count: number;
  tasks: Task[];
}

export interface ProjectsResponse {
  count: number;
  projects: Project[];
}

export interface AreasResponse {
  count: number;
  areas: Area[];
}

export interface ProjectDetailResponse {
  project: Project;
  tasks: Task[];
}

export interface AreaDetailResponse {
  area: Area;
  projects: Project[];
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

export async function fetchProjects(): Promise<ProjectsResponse> {
  const res = await fetch('/api/projects', { credentials: 'include' });
  if (!res.ok) throw new Error(`fetchProjects failed: ${res.status}`);
  return (await res.json()) as ProjectsResponse;
}

export async function fetchAreas(): Promise<AreasResponse> {
  const res = await fetch('/api/areas', { credentials: 'include' });
  if (!res.ok) throw new Error(`fetchAreas failed: ${res.status}`);
  return (await res.json()) as AreasResponse;
}

export async function fetchProjectDetail(id: string): Promise<ProjectDetailResponse> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetchProjectDetail(${id}) failed: ${res.status}`);
  return (await res.json()) as ProjectDetailResponse;
}

export async function fetchAreaDetail(id: string): Promise<AreaDetailResponse> {
  const res = await fetch(`/api/areas/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetchAreaDetail(${id}) failed: ${res.status}`);
  return (await res.json()) as AreaDetailResponse;
}

export async function fetchChecklist(taskId: string): Promise<ChecklistItem[]> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/checklist`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`fetchChecklist(${taskId}) failed: ${res.status}`);
  const data = (await res.json()) as { items: ChecklistItem[] };
  return data.items;
}

export async function addChecklistItem(taskId: string, text: string): Promise<ChecklistItem> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/checklist`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`addChecklistItem failed: ${res.status}`);
  const data = (await res.json()) as { item: ChecklistItem };
  return data.item;
}

export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  patch: { text?: string; checked?: boolean },
): Promise<ChecklistItem> {
  const res = await fetch(
    `/api/tasks/${encodeURIComponent(taskId)}/checklist/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(`updateChecklistItem failed: ${res.status}`);
  const data = (await res.json()) as { item: ChecklistItem };
  return data.item;
}

export async function deleteChecklistItem(taskId: string, itemId: string): Promise<void> {
  const res = await fetch(
    `/api/tasks/${encodeURIComponent(taskId)}/checklist/${encodeURIComponent(itemId)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) throw new Error(`deleteChecklistItem failed: ${res.status}`);
}

export const checklistQueryKey = (taskId: string) => ['checklist', taskId] as const;
export const tasksQueryKey = (view: ViewKey) => ['tasks', view] as const;
export const taskQueryKey = (id: string) => ['task', id] as const;
export const projectsQueryKey = () => ['projects'] as const;
export const areasQueryKey = () => ['areas'] as const;
export const projectQueryKey = (id: string) => ['project', id] as const;
export const areaQueryKey = (id: string) => ['area', id] as const;
