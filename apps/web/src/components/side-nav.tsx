'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
  { href: '/projects', label: 'Projects' },
  { href: '/areas', label: 'Areas' },
] as const;

interface NavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function useNavDrawer() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNavDrawer must be used inside <SideNavProvider>');
  return ctx;
}

export function SideNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close when route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <NavContext.Provider value={{ open, setOpen }}>
      {children}
      <SideNavDrawer open={open} onClose={useCallback(() => setOpen(false), [])} />
    </NavContext.Provider>
  );
}

function SideNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

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
      aria-hidden={!open}
      className={clsx(
        'fixed inset-0 z-40 transition-opacity',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={clsx(
          'absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-[var(--stuff-border)] bg-[var(--stuff-bg)] shadow-xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="flex flex-col">
            {ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors',
                      active
                        ? 'bg-[var(--stuff-fg)] text-[var(--stuff-bg)]'
                        : 'text-[var(--stuff-fg)] hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </div>
  );
}

export function NavMenuButton() {
  const { setOpen } = useNavDrawer();
  return (
    <button
      type="button"
      aria-label="Open menu"
      onClick={() => setOpen(true)}
      className="-ml-2 inline-flex size-9 items-center justify-center rounded-lg text-[var(--stuff-fg)] hover:bg-black/5 dark:hover:bg-white/5"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}
