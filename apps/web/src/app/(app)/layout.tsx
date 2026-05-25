import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/query-provider';
import { BottomNav } from '@/components/bottom-nav';
import { QuickEntryFab } from '@/components/quick-entry';
import { AgentActionsBanner } from '@/components/agent-actions-banner';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <AgentActionsBanner />
        <div className="flex-1">{children}</div>
        <QuickEntryFab />
        <BottomNav />
      </div>
    </QueryProvider>
  );
}
