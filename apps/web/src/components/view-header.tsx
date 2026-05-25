'use client';

import { signOutAction } from '@/lib/actions';
import { NavMenuButton } from './side-nav';

export function ViewHeader({ title }: { title: string }) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--stuff-border)] bg-[var(--stuff-bg)]/95 px-4 py-3 backdrop-blur"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <NavMenuButton />
      <h1 className="flex-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-xs text-[var(--stuff-muted)] hover:text-current"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
