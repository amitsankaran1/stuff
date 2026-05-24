'use client';

import { useState, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Task } from '@stuff/shared';
import { fetchProjectDetail, projectQueryKey } from '@/lib/api';
import { useCompleteTask } from '@/lib/mutations';
import { ViewHeader } from '@/components/view-header';
import { TaskRow } from '@/components/task-row';
import { TaskDetailSheet } from '@/components/task-detail';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selected, setSelected] = useState<Task | null>(null);
  const complete = useCompleteTask();

  const detail = useQuery({
    queryKey: projectQueryKey(id),
    queryFn: () => fetchProjectDetail(id),
  });

  const title = detail.data?.project.name ?? 'Project';
  const tasks = detail.data?.tasks ?? [];

  return (
    <>
      <ViewHeader title={title} />
      {detail.isLoading ? (
        <p className="px-4 py-6 text-sm text-[var(--stuff-muted)]">Loading…</p>
      ) : detail.isError ? (
        <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load: {(detail.error as Error).message}
        </p>
      ) : tasks.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-[var(--stuff-muted)]">
          No tasks in this project yet.
        </p>
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
      <TaskDetailSheet task={selected} onClose={() => setSelected(null)} />
    </>
  );
}
