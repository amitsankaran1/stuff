'use client';

import { useEffect, useState } from 'react';
import type { Task, TaskStatus } from '@stuff/shared';
import { useDeleteTask, useUpdateTask } from '@/lib/mutations';
import { Sheet } from './sheet';

const STATUS_OPTIONS: TaskStatus[] = [
  'Inbox',
  'Today',
  'Anytime',
  'Someday',
  'Scheduled',
  'Done',
  'Cancelled',
];

interface Props {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailSheet({ task, onClose }: Props) {
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [name, setName] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Inbox');
  const [when, setWhen] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');

  useEffect(() => {
    if (!task) return;
    setName(task.name);
    setStatus(task.status);
    setWhen(task.when ? task.when.slice(0, 16) : '');
    setDeadline(task.deadline ?? '');
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <Sheet open={false} onClose={onClose}>
        <></>
      </Sheet>
    );
  }

  function save() {
    if (!task) return;
    const patch = {
      name: name.trim() || task.name,
      status,
      when: when ? new Date(when).toISOString() : null,
      deadline: deadline || null,
    };
    update.mutate({ id: task.id, patch });
    onClose();
  }

  function destroy() {
    if (!task) return;
    if (!confirm(`Delete "${task.name}"?`)) return;
    del.mutate(task.id);
    onClose();
  }

  return (
    <Sheet open={!!task} onClose={onClose} title="Edit task">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--stuff-muted)]">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-base outline-none focus:border-current"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--stuff-muted)]">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-base outline-none focus:border-current"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--stuff-muted)]">When</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-base outline-none focus:border-current"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--stuff-muted)]">Deadline</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-base outline-none focus:border-current"
          />
        </label>

        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={destroy}
            className="rounded-xl px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm text-[var(--stuff-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-current px-4 py-2 text-sm font-medium text-[var(--stuff-bg)]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
