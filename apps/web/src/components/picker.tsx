'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Sheet } from './sheet';

interface PickerItem {
  id: string;
  label: string;
  hint?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  items: PickerItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allowClear?: boolean;
  emptyState?: string;
}

export function Picker({
  open,
  onClose,
  title,
  items,
  selectedId,
  onSelect,
  allowClear = true,
  emptyState = 'Nothing yet.',
}: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  function pick(id: string | null) {
    onSelect(id);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-2 text-base outline-none focus:border-current"
        />

        {allowClear ? (
          <button
            type="button"
            onClick={() => pick(null)}
            className={clsx(
              'rounded-lg px-3 py-2 text-left text-sm',
              selectedId === null
                ? 'bg-[var(--stuff-fg)] text-[var(--stuff-bg)]'
                : 'text-[var(--stuff-muted)]',
            )}
          >
            None
          </button>
        ) : null}

        {filtered.length === 0 ? (
          <p className="px-1 py-3 text-sm text-[var(--stuff-muted)]">{emptyState}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item.id)}
                  className={clsx(
                    'flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm',
                    item.id === selectedId
                      ? 'bg-[var(--stuff-fg)] text-[var(--stuff-bg)]'
                      : 'hover:bg-[var(--stuff-border)]/40',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.hint ? (
                    <span
                      className={clsx(
                        'shrink-0 text-xs',
                        item.id === selectedId
                          ? 'text-[var(--stuff-bg)]/70'
                          : 'text-[var(--stuff-muted)]',
                      )}
                    >
                      {item.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
