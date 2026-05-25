'use client';

import type { Task } from '@stuff/shared';
import clsx from 'clsx';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  task: Task;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

export function TaskRow({ task, onSelect, onToggleComplete }: Props) {
  const done = task.status === 'Done' || task.status === 'Cancelled';
  const when = formatDate(task.when);
  const deadline = formatDate(task.deadline);
  const agentRecent =
    task.agentTouchedAt &&
    Date.now() - new Date(task.agentTouchedAt).getTime() < 24 * 60 * 60 * 1000;

  return (
    <li
      className={clsx(
        'flex items-start gap-3 border-b border-[var(--stuff-border)] px-4 py-3',
        done && 'opacity-50',
      )}
    >
      <button
        type="button"
        aria-label={done ? `Mark "${task.name}" as not done` : `Mark "${task.name}" as done`}
        onClick={() => onToggleComplete(task)}
        className={clsx(
          'mt-0.5 size-5 shrink-0 rounded-full border transition-colors',
          done ? 'border-current bg-current' : 'border-[var(--stuff-border)] hover:border-current',
        )}
      />
      <button
        type="button"
        aria-label={`Open task: ${task.name}`}
        onClick={() => onSelect(task)}
        className="flex min-w-0 flex-1 flex-col text-left active:bg-black/5 dark:active:bg-white/5"
      >
        <div className="flex items-baseline gap-2">
          <span className={clsx('truncate text-[15px]', done && 'line-through')}>{task.name}</span>
          {agentRecent ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-pink-500"
              aria-label="Touched by an agent"
            />
          ) : null}
        </div>
        {(when || deadline || task.tags.length > 0) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--stuff-muted)]">
            {when ? <span>{when}</span> : null}
            {deadline ? <span className="text-red-500">⚑ {deadline}</span> : null}
            {task.tags.slice(0, 3).map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        )}
        {task.proposedStatus ? (
          <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-pink-500/10 px-2 py-0.5 text-xs text-pink-600 dark:text-pink-300">
            Agent proposes: {task.proposedStatus}
          </div>
        ) : null}
      </button>
    </li>
  );
}
