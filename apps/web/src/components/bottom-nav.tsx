'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const ITEMS = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/today', label: 'Today' },
  { href: '/upcoming', label: 'Upcoming' },
  { href: '/anytime', label: 'Anytime' },
  { href: '/someday', label: 'Someday' },
  { href: '/logbook', label: 'Logbook' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky bottom-0 z-10 flex shrink-0 items-center gap-1 overflow-x-auto border-t border-[var(--stuff-border)] bg-[var(--stuff-bg)]/95 px-2 py-2 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-current text-[var(--stuff-bg)]'
                : 'text-[var(--stuff-muted)] hover:text-current',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
