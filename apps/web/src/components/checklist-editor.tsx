'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChecklistItem } from '@stuff/shared';
import clsx from 'clsx';
import {
  addChecklistItem,
  checklistQueryKey,
  deleteChecklistItem,
  fetchChecklist,
  updateChecklistItem,
} from '@/lib/api';

export function ChecklistEditor({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const key = checklistQueryKey(taskId);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: () => fetchChecklist(taskId),
    staleTime: 30_000,
  });

  const add = useMutation({
    mutationFn: (text: string) => addChecklistItem(taskId, text),
    onMutate: async (text) => {
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      const optimistic: ChecklistItem = {
        id: `optimistic:${crypto.randomUUID()}`,
        text,
        checked: false,
      };
      qc.setQueryData<ChecklistItem[]>(key, [...(prev ?? []), optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      updateChecklistItem(taskId, id, { checked }),
    onMutate: async ({ id, checked }) => {
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(
        key,
        (prev ?? []).map((i) => (i.id === id ? { ...i, checked } : i)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const rename = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateChecklistItem(taskId, id, { text }),
    onMutate: async ({ id, text }) => {
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(
        key,
        (prev ?? []).map((i) => (i.id === id ? { ...i, text } : i)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(taskId, id),
    onMutate: async (id) => {
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      qc.setQueryData<ChecklistItem[]>(key, (prev ?? []).filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-[var(--stuff-muted)]">Checklist</span>
      {isLoading ? (
        <p className="text-xs text-[var(--stuff-muted)]">Loading…</p>
      ) : isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          Couldn't load: {(error as Error).message}
        </p>
      ) : (
        <ul className="flex flex-col">
          {(data ?? []).map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={(checked) => toggle.mutate({ id: item.id, checked })}
              onRename={(text) => {
                if (text.trim() && text !== item.text) rename.mutate({ id: item.id, text });
              }}
              onDelete={() => remove.mutate(item.id)}
            />
          ))}
        </ul>
      )}
      <AddItemForm onAdd={(text) => add.mutate(text)} />
    </div>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: (checked: boolean) => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(item.text);

  return (
    <li className="flex items-center gap-2 py-1">
      <button
        type="button"
        aria-label={item.checked ? 'Mark unchecked' : 'Mark checked'}
        onClick={() => onToggle(!item.checked)}
        className={clsx(
          'size-4 shrink-0 rounded border',
          item.checked ? 'border-current bg-current' : 'border-[var(--stuff-border)]',
        )}
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onRename(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className={clsx(
          'flex-1 bg-transparent text-[15px] outline-none',
          item.checked && 'text-[var(--stuff-muted)] line-through',
        )}
      />
      <button
        type="button"
        aria-label="Remove item"
        onClick={onDelete}
        className="shrink-0 px-2 text-[var(--stuff-muted)] hover:text-current"
      >
        ×
      </button>
    </li>
  );
}

function AddItemForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
  }
  return (
    <form onSubmit={submit} className="mt-1 flex items-center gap-2">
      <span aria-hidden className="size-4 shrink-0 rounded border border-dashed border-[var(--stuff-border)]" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add item…"
        className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--stuff-muted)]"
      />
    </form>
  );
}
