export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Stuff</h1>
        <p className="mt-1 text-sm text-[var(--stuff-muted)]">
          A fast, Notion-backed task manager.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--stuff-border)] bg-white/40 p-4 text-sm dark:bg-white/5">
        <p className="font-medium">M0 — Scaffolding</p>
        <p className="mt-1 text-[var(--stuff-muted)]">
          The schema and migration scripts live in <code>packages/notion</code>. Read-only views
          land in M1.
        </p>
      </section>

      <nav className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--stuff-muted)]">Planned views</span>
        <ul className="grid grid-cols-2 gap-2">
          {['Inbox', 'Today', 'Upcoming', 'Anytime', 'Someday', 'Logbook'].map((v) => (
            <li
              key={v}
              className="rounded-xl border border-[var(--stuff-border)] px-3 py-2 opacity-60"
            >
              {v}
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
