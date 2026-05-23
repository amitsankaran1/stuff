'use client';

import { useState, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { idbPersister, makeQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister: idbPersister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
