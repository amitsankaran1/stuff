import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/query-provider';
import { SideNavProvider } from '@/components/side-nav';
import { QuickEntryFab } from '@/components/quick-entry';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SideNavProvider>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <div className="flex-1">{children}</div>
          <QuickEntryFab />
        </div>
      </SideNavProvider>
    </QueryProvider>
  );
}
