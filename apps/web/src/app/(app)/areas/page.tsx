'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  areasQueryKey,
  fetchAreas,
  fetchProjects,
  projectsQueryKey,
} from '@/lib/api';
import { ViewHeader } from '@/components/view-header';

export default function AreasPage() {
  const areas = useQuery({ queryKey: areasQueryKey(), queryFn: fetchAreas });
  const projects = useQuery({ queryKey: projectsQueryKey(), queryFn: fetchProjects });

  if (areas.isLoading) {
    return (
      <>
        <ViewHeader title="Areas" />
        <p className="px-4 py-6 text-sm text-[var(--stuff-muted)]">Loading…</p>
      </>
    );
  }

  const areaList = areas.data?.areas ?? [];
  const projectList = projects.data?.projects ?? [];
  const counts = new Map<string, number>();
  for (const p of projectList) {
    if (p.areaId) counts.set(p.areaId, (counts.get(p.areaId) ?? 0) + 1);
  }

  if (areaList.length === 0) {
    return (
      <>
        <ViewHeader title="Areas" />
        <p className="px-4 py-12 text-center text-sm text-[var(--stuff-muted)]">
          No areas yet.
        </p>
      </>
    );
  }

  return (
    <>
      <ViewHeader title="Areas" />
      <ul className="flex flex-col">
        {areaList.map((a) => (
          <li key={a.id}>
            <Link
              href={`/areas/${a.id}`}
              className="flex items-center justify-between border-b border-[var(--stuff-border)] px-4 py-3 active:bg-black/5 dark:active:bg-white/5"
            >
              <span className="text-[15px]">{a.name}</span>
              <span className="text-xs text-[var(--stuff-muted)]">
                {counts.get(a.id) ?? 0} project{(counts.get(a.id) ?? 0) === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
