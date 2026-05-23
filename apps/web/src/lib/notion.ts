import { createStuffNotionClient } from '@stuff/notion';

declare global {
  // eslint-disable-next-line no-var
  var __stuffNotion: ReturnType<typeof createStuffNotionClient> | undefined;
}

export function getNotion() {
  if (!process.env.NOTION_TOKEN) {
    throw new Error('NOTION_TOKEN is not set');
  }
  if (!globalThis.__stuffNotion) {
    globalThis.__stuffNotion = createStuffNotionClient({ token: process.env.NOTION_TOKEN });
  }
  return globalThis.__stuffNotion;
}

export const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID ?? '';
