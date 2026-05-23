import { signOut } from '@/lib/auth';

export function ViewHeader({ title }: { title: string }) {
  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--stuff-border)] bg-[var(--stuff-bg)]/95 px-4 py-3 backdrop-blur"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <form action={doSignOut}>
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
