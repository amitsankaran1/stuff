'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTasks, tasksQueryKey } from '@/lib/api';
import type { ViewKey } from '@/lib/views';
import { TaskRow } from './task-row';

export function TaskList({ view }: { view: ViewKey }) {
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
  if (tasks.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--stuff-muted)]">
        Nothing here yet.
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
      {isFetching ? (
        <p className="px-4 py-2 text-xs text-[var(--stuff-muted)]">Refreshing…</p>
      ) : null}
    </>
  );
}
