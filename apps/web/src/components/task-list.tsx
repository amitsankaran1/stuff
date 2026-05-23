'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Task } from '@stuff/shared';
import { fetchTasks, tasksQueryKey } from '@/lib/api';
import { useCompleteTask } from '@/lib/mutations';
import type { ViewKey } from '@/lib/views';
import { TaskRow } from './task-row';
import { TaskDetailSheet } from './task-detail';

export function TaskList({ view }: { view: ViewKey }) {
  const [selected, setSelected] = useState<Task | null>(null);
  const complete = useCompleteTask();

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: tasksQueryKey(view),
    queryFn: () => fetchTasks(view),
  });

  if (isLoading && !data) {
    return <p className="px-4 py-6 text-sm text-[var(--stuff-muted)]">Loading…</p>;
  }
  if (isError) {
    return (
      <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
        Couldn't load tasks: {(error as Error).message}
      </p>
    );
  }

  const tasks = data?.tasks ?? [];

  return (
    <>
      {tasks.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-[var(--stuff-muted)]">
          Nothing here yet.
        </div>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onSelect={setSelected}
              onToggleComplete={(task) => {
                const done = task.status !== 'Done' && task.status !== 'Cancelled';
                complete.mutate({ id: task.id, done });
              }}
            />
          ))}
        </ul>
      )}

      {isFetching ? (
        <p className="px-4 py-2 text-xs text-[var(--stuff-muted)]">Refreshing…</p>
      ) : null}

      <TaskDetailSheet task={selected} onClose={() => setSelected(null)} />
    </>
  );
}
