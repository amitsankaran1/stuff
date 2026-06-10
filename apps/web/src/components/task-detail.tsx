'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Task, TaskStatus } from '@stuff/shared';
import {
  areasQueryKey,
  fetchAreas,
  fetchProjects,
  projectsQueryKey,
} from '@/lib/api';
import { useDeleteTask, useUpdateTask } from '@/lib/mutations';
import { Sheet } from './sheet';
import { Picker } from './picker';
import { ChecklistEditor } from './checklist-editor';

/**
 * Convert a UTC ISO timestamp to the local "YYYY-MM-DDTHH:mm" form that a
 * datetime-local input expects. Slicing the ISO string directly would show
 * UTC wall-clock time and shift the task on every save round-trip.
 */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [projectId, setProjectId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'project' | 'area' | null>(null);

  const projects = useQuery({
    queryKey: projectsQueryKey(),
    queryFn: fetchProjects,
    enabled: !!task,
    staleTime: 60_000,
  });
  const areas = useQuery({
    queryKey: areasQueryKey(),
    queryFn: fetchAreas,
    enabled: !!task,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!task) return;
    setName(task.name);
    setStatus(task.status);
    setWhen(task.when ? toDatetimeLocal(task.when) : '');
    setDeadline(task.deadline ?? '');
    setProjectId(task.projectId);
    setAreaId(task.areaId);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <Sheet open={false} onClose={onClose}>
        <></>
      </Sheet>
    );
  }

  const projectLabel =
    projects.data?.projects.find((p) => p.id === projectId)?.name ??
    (projectId ? 'Project' : 'None');
  const areaLabel =
    areas.data?.areas.find((a) => a.id === areaId)?.name ?? (areaId ? 'Area' : 'None');

  function save() {
    if (!task) return;
    update.mutate({
      id: task.id,
      patch: {
        name: name.trim() || task.name,
        status,
        when: when ? new Date(when).toISOString() : null,
        deadline: deadline || null,
        projectId,
        areaId,
      },
    });
    onClose();
  }

  function destroy() {
    if (!task) return;
    if (!confirm(`Delete "${task.name}"?`)) return;
    del.mutate(task.id);
    onClose();
  }

  return (
    <>
      <Sheet open={!!task && !picker} onClose={onClose} title="Edit task">
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

          <PickerField
            label="Project"
            valueLabel={projectLabel}
            placeholder="None"
            onClick={() => setPicker('project')}
          />
          <PickerField
            label="Area"
            valueLabel={areaLabel}
            placeholder="None"
            onClick={() => setPicker('area')}
          />

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

          <ChecklistEditor taskId={task.id} />

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
                className="rounded-xl bg-[var(--stuff-fg)] px-4 py-2 text-sm font-medium text-[var(--stuff-bg)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Sheet>

      <Picker
        open={picker === 'project'}
        onClose={() => setPicker(null)}
        title="Project"
        items={(projects.data?.projects ?? []).map((p) => ({
          id: p.id,
          label: p.name,
          hint: p.status,
        }))}
        selectedId={projectId}
        onSelect={(id) => setProjectId(id)}
        emptyState="No projects yet."
      />

      <Picker
        open={picker === 'area'}
        onClose={() => setPicker(null)}
        title="Area"
        items={(areas.data?.areas ?? []).map((a) => ({ id: a.id, label: a.name }))}
        selectedId={areaId}
        onSelect={(id) => setAreaId(id)}
        emptyState="No areas yet."
      />
    </>
  );
}

function PickerField({
  label,
  valueLabel,
  placeholder,
  onClick,
}: {
  label: string;
  valueLabel: string;
  placeholder: string;
  onClick: () => void;
}) {
  const empty = valueLabel === placeholder;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-[var(--stuff-muted)]">{label}</span>
      <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-between rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-left text-base"
      >
        <span className={empty ? 'text-[var(--stuff-muted)]' : undefined}>{valueLabel}</span>
        <span aria-hidden className="text-[var(--stuff-muted)]">
          ›
        </span>
      </button>
    </div>
  );
}
