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

export default function ProjectsPage() {
  const projects = useQuery({ queryKey: projectsQueryKey(), queryFn: fetchProjects });
  const areas = useQuery({ queryKey: areasQueryKey(), queryFn: fetchAreas });

  if (projects.isLoading) {
    return (
      <>
        <ViewHeader title="Projects" />
        <p className="px-4 py-6 text-sm text-[var(--stuff-muted)]">Loading…</p>
      </>
    );
  }
  if (projects.isError) {
    return (
      <>
        <ViewHeader title="Projects" />
        <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load projects: {(projects.error as Error).message}
        </p>
      </>
    );
  }

  const projectList = projects.data?.projects ?? [];
  const areaList = areas.data?.areas ?? [];
  const areasById = new Map(areaList.map((a) => [a.id, a]));

  const groups = new Map<string | null, typeof projectList>();
  for (const p of projectList) {
    const key = p.areaId ?? null;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  // Sort area groups: known areas alphabetically, then "Unassigned" last.
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const an = areasById.get(a)?.name ?? '';
    const bn = areasById.get(b)?.name ?? '';
    return an.localeCompare(bn);
  });

  if (projectList.length === 0) {
    return (
      <>
        <ViewHeader title="Projects" />
        <p className="px-4 py-12 text-center text-sm text-[var(--stuff-muted)]">
          No projects yet.
        </p>
      </>
    );
  }

  return (
    <>
      <ViewHeader title="Projects" />
      <div className="flex flex-col">
        {sortedKeys.map((areaKey) => {
          const area = areaKey ? areasById.get(areaKey) : null;
          const list = groups.get(areaKey) ?? [];
          return (
            <section key={areaKey ?? '__none__'}>
              <h2 className="px-4 pt-5 pb-1 text-xs font-medium uppercase tracking-wider text-[var(--stuff-muted)]">
                {area?.name ?? 'Unassigned'}
              </h2>
              <ul className="flex flex-col">
                {list.map((p) => (
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
            </section>
          );
        })}
      </div>
    </>
  );
}
