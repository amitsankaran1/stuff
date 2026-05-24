'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { areaQueryKey, fetchAreaDetail } from '@/lib/api';
import { ViewHeader } from '@/components/view-header';

export default function AreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useQuery({ queryKey: areaQueryKey(id), queryFn: () => fetchAreaDetail(id) });

  const title = detail.data?.area.name ?? 'Area';
  const projects = detail.data?.projects ?? [];

  return (
    <>
      <ViewHeader title={title} />
      {detail.isLoading ? (
        <p className="px-4 py-6 text-sm text-[var(--stuff-muted)]">Loading…</p>
      ) : detail.isError ? (
        <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load: {(detail.error as Error).message}
        </p>
      ) : projects.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-[var(--stuff-muted)]">
          No projects in this area yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex items-center justify-between border-b border-[var(--stuff-border)] px-4 py-3 active:bg-black/5 dark:active:bg-white/5"
              >
                <span className="text-[15px]">{p.name}</span>
                <span className="text-xs text-[var(--stuff-muted)]">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
