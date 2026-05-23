'use client';

import { useState, type FormEvent } from 'react';
import { useCreateTask } from '@/lib/mutations';
import { Sheet } from './sheet';

export function QuickEntryFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="New task"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-5 z-20 flex size-12 items-center justify-center rounded-full bg-[var(--stuff-fg)] text-2xl text-[var(--stuff-bg)] shadow-lg"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
      >
        <span aria-hidden>+</span>
      </button>
      <QuickEntrySheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function QuickEntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const create = useCreateTask();

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed, status: 'Inbox' });
    setName('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="New task">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What needs to happen?"
          autoFocus={open}
          className="rounded-xl border border-[var(--stuff-border)] bg-transparent px-3 py-3 text-base outline-none focus:border-current"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-[var(--stuff-muted)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-xl bg-[var(--stuff-fg)] px-4 py-2 text-sm font-medium text-[var(--stuff-bg)] disabled:opacity-40"
          >
            Add to Inbox
          </button>
        </div>
      </form>
    </Sheet>
  );
}
