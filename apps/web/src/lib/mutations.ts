'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskCreate, TaskStatus, TaskUpdate } from '@stuff/shared';
import { VIEW_KEYS, type ViewKey } from './views';
import {
  createTask,
  deleteTask,
  tasksQueryKey,
  updateTask,
  type TasksResponse,
} from './api';

type Patch = Omit<TaskUpdate, 'id'>;
type CachedTasksResponse = TasksResponse;

function nowISO(): string {
  return new Date().toISOString();
}

function statusToView(status: TaskStatus): ViewKey | null {
  switch (status) {
    case 'Inbox':
      return 'inbox';
    case 'Today':
      return 'today';
    case 'Anytime':
      return 'anytime';
    case 'Someday':
      return 'someday';
    case 'Done':
    case 'Cancelled':
      return 'logbook';
    case 'Scheduled':
      return 'upcoming';
  }
}

/**
 * Snapshot every per-view tasks query, apply a mutator that produces the next
 * cache state, and return a rollback function for use in onError.
 */
function withAllViews(
  qc: ReturnType<typeof useQueryClient>,
  mutate: (view: ViewKey, prev: CachedTasksResponse | undefined) => CachedTasksResponse | undefined,
): () => void {
  const snapshots = new Map<ViewKey, CachedTasksResponse | undefined>();
  for (const v of VIEW_KEYS) {
    const prev = qc.getQueryData<CachedTasksResponse>(tasksQueryKey(v));
    snapshots.set(v, prev);
    const next = mutate(v, prev);
    if (next !== undefined) qc.setQueryData(tasksQueryKey(v), next);
  }
  return () => {
    for (const [v, prev] of snapshots) {
      qc.setQueryData(tasksQueryKey(v), prev);
    }
  };
}

function invalidateAllViews(qc: ReturnType<typeof useQueryClient>) {
  for (const v of VIEW_KEYS) {
    qc.invalidateQueries({ queryKey: tasksQueryKey(v) });
  }
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreate) => createTask(input),
    onMutate: async (input) => {
      const optimistic: Task = {
        id: `optimistic:${crypto.randomUUID()}`,
        name: input.name,
        status: input.status ?? 'Inbox',
        when: input.when ?? null,
        deadline: input.deadline ?? null,
        projectId: input.projectId ?? null,
        areaId: input.areaId ?? null,
        heading: input.heading ?? null,
        tags: input.tags ?? [],
        recurrence: input.recurrence ?? null,
        notes: input.notes ?? '',
        checklist: input.checklist ?? [],
        completedAt: null,
        source: input.source ?? 'User',
        agentTouchedAt: input.agentTouchedAt ?? null,
        agentNotes: input.agentNotes ?? null,
        proposedStatus: input.proposedStatus ?? null,
        lastRemindedAt: null,
        externalId: input.externalId ?? null,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      const targetView = statusToView(optimistic.status);
      const rollback = withAllViews(qc, (view, prev) => {
        if (view !== targetView || !prev) return prev;
        return { ...prev, count: prev.count + 1, tasks: [optimistic, ...prev.tasks] };
      });
      return { rollback, optimisticId: optimistic.id };
    },
    onError: (_err, _input, ctx) => ctx?.rollback?.(),
    onSettled: () => invalidateAllViews(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Patch }) => updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      const rollback = withAllViews(qc, (_view, prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t,
        );
        return { ...prev, tasks };
      });
      return { rollback };
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => invalidateAllViews(qc),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTask(id, {
        status: done ? 'Done' : 'Inbox',
        completedAt: done ? nowISO() : null,
      }),
    onMutate: async ({ id, done }) => {
      const rollback = withAllViews(qc, (_view, prev) => {
        if (!prev) return prev;
        const nextStatus: TaskStatus = done ? 'Done' : 'Inbox';
        const tasks = prev.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: nextStatus,
                completedAt: done ? nowISO() : null,
                updatedAt: nowISO(),
              }
            : t,
        );
        return { ...prev, tasks };
      });
      return { rollback };
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => invalidateAllViews(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => {
      const rollback = withAllViews(qc, (_view, prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.filter((t) => t.id !== id);
        if (tasks.length === prev.tasks.length) return prev;
        return { ...prev, count: tasks.length, tasks };
      });
      return { rollback };
    },
    onError: (_err, _id, ctx) => ctx?.rollback?.(),
    onSettled: () => invalidateAllViews(qc),
  });
}
