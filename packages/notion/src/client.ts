import { Client } from '@notionhq/client';
import PQueue from 'p-queue';

const NOTION_API_RPS = 3;

export interface StuffNotionClientOptions {
  token: string;
  concurrency?: number;
}

/**
 * Wraps the Notion client with a small concurrency queue so we stay under
 * Notion's ~3 rps rate limit even when the proxy fans out parallel writes.
 */
export function createStuffNotionClient(opts: StuffNotionClientOptions): {
  notion: Client;
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>;
} {
  const notion = new Client({ auth: opts.token });
  const queue = new PQueue({
    concurrency: opts.concurrency ?? NOTION_API_RPS,
    interval: 1000,
    intervalCap: NOTION_API_RPS,
  });

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> =>
    queue.add(fn, { throwOnTimeout: true }) as Promise<T>;

  return { notion, enqueue };
}
