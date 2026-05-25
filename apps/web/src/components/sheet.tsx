'use client';

import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      // `inert` removes the subtree from the a11y tree and tab order
      // even while we keep it mounted for the slide-out animation.
      inert={!open}
      aria-hidden={!open}
      className={clsx(
        'fixed inset-0 z-50 flex items-end justify-center transition-opacity',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative mx-auto flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-t border-[var(--stuff-border)] bg-[var(--stuff-bg)] shadow-xl transition-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-[var(--stuff-border)]" />
        {title ? (
          <header className="px-5 pt-3 pb-2 text-base font-semibold">{title}</header>
        ) : null}
        <div className="overflow-y-auto px-5 pt-1 pb-5">{children}</div>
      </div>
    </div>
  );
}
