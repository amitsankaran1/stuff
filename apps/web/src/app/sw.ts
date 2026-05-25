/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

interface PushPayloadShape {
  kind?: string;
  taskId?: string;
  title?: string;
  body?: string;
  url?: string;
}

function parsePayload(event: PushEvent): PushPayloadShape {
  if (!event.data) return {};
  try {
    return event.data.json() as PushPayloadShape;
  } catch {
    return { title: 'Stuff', body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const data = parsePayload(event);
  const title = data.title || 'Stuff';
  const body = data.body;
  const tag = data.taskId ? `task:${data.taskId}` : data.kind || 'stuff';
  const url = data.url || '/today';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data as { url?: string } | undefined)?.url ?? '/today';

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of all) {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch {
              // navigate can throw on cross-origin or while focus is being handled; ignore.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
