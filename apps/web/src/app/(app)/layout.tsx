import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/query-provider';
import { BottomNav } from '@/components/bottom-nav';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <div className="flex-1">{children}</div>
        <BottomNav />
      </div>
    </QueryProvider>
  );
}
