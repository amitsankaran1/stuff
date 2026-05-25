import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import {
  buildDeviceCreatePayload,
  buildDeviceProperties,
  mapDevice,
} from '@stuff/notion';
import type { Device, DeviceRegistration } from '@stuff/shared';
import { getNotion, DEVICES_DB_ID } from './notion';

export function devicesConfigured(): boolean {
  return Boolean(DEVICES_DB_ID);
}

async function findByDeviceId(deviceId: string): Promise<PageObjectResponse | null> {
  const { notion, enqueue } = getNotion();
  const res: QueryDatabaseResponse = await enqueue(() =>
    notion.databases.query({
      database_id: DEVICES_DB_ID,
      filter: { property: 'Device ID', rich_text: { equals: deviceId } },
      page_size: 1,
    }),
  );
  const hit = res.results[0];
  if (!hit || hit.object !== 'page' || !('properties' in hit)) return null;
  return hit as PageObjectResponse;
}

export async function listDevices(): Promise<Device[]> {
  const { notion, enqueue } = getNotion();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res: QueryDatabaseResponse = await enqueue(() =>
      notion.databases.query({
        database_id: DEVICES_DB_ID,
        page_size: 100,
        start_cursor: cursor,
      }),
    );
    for (const r of res.results) {
      if (r.object === 'page' && 'properties' in r) pages.push(r as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages.map(mapDevice);
}

export async function upsertDevice(input: DeviceRegistration): Promise<Device> {
  const { notion, enqueue } = getNotion();
  const now = new Date().toISOString();
  const existing = await findByDeviceId(input.deviceId);
  if (existing) {
    const updated = await enqueue(() =>
      notion.pages.update({
        page_id: existing.id,
        properties: buildDeviceProperties(input, now),
      }),
    );
    return mapDevice(updated as PageObjectResponse);
  }
  const created = await enqueue(() =>
    notion.pages.create(buildDeviceCreatePayload(DEVICES_DB_ID, input, now)),
  );
  return mapDevice(created as PageObjectResponse);
}

export async function deleteDeviceByDeviceId(deviceId: string): Promise<boolean> {
  const page = await findByDeviceId(deviceId);
  if (!page) return false;
  const { notion, enqueue } = getNotion();
  await enqueue(() => notion.pages.update({ page_id: page.id, archived: true }));
  return true;
}

export async function deleteDeviceByPageId(pageId: string): Promise<void> {
  const { notion, enqueue } = getNotion();
  await enqueue(() => notion.pages.update({ page_id: pageId, archived: true }));
}

export async function touchDevice(pageId: string): Promise<void> {
  const { notion, enqueue } = getNotion();
  await enqueue(() =>
    notion.pages.update({
      page_id: pageId,
      properties: { 'Last Seen At': { date: { start: new Date().toISOString() } } },
    }),
  );
}
