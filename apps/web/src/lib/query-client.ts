'use client';

import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

const ONE_DAY = 1000 * 60 * 60 * 24;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: ONE_DAY * 7,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: 60_000,
        retry: 1,
      },
    },
  });
}

export const idbPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key: string) => get<string>(key).then((v) => v ?? null),
    setItem: (key: string, value: string) => set(key, value),
    removeItem: (key: string) => del(key),
  },
  key: 'stuff-query-cache',
  throttleTime: 1000,
});
