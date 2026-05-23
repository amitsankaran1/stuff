import 'dotenv/config';
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { createStuffNotionClient } from '../client.js';
import type { TaskStatus } from '@stuff/shared';

const token = process.env.NOTION_TOKEN;
const tasksDbId = process.env.NOTION_TASKS_DB_ID;
const myTasksId = process.env.NOTION_MY_TASKS_DB_ID;
const trackerId = process.env.NOTION_TASK_TRACKER_DB_ID;

if (!token) throw new Error('NOTION_TOKEN is required');
if (!tasksDbId) throw new Error('NOTION_TASKS_DB_ID is required (run init first)');

const { notion, enqueue } = createStuffNotionClient({ token });

const richText = (p: PageObjectResponse['properties'][string] | undefined) => {
  if (!p || p.type !== 'rich_text') return '';
  return p.rich_text.map((r) => r.plain_text).join('');
};
const title = (p: PageObjectResponse['properties'][string] | undefined) => {
  if (!p || p.type !== 'title') return '';
  return p.title.map((r) => r.plain_text).join('');
};
const dateStart = (p: PageObjectResponse['properties'][string] | undefined) => {
  if (!p || p.type !== 'date' || !p.date) return null;
  return p.date.start;
};
const statusName = (p: PageObjectResponse['properties'][string] | undefined): string | null => {
  if (!p) return null;
  if (p.type === 'status' && p.status) return p.status.name;
  if (p.type === 'select' && p.select) return p.select.name;
  return null;
};

function mapStatus(raw: string | null, hasWhen: boolean): TaskStatus {
  if (!raw) return hasWhen ? 'Scheduled' : 'Inbox';
  const v = raw.toLowerCase();
  if (v.includes('done') || v.includes('complete')) return 'Done';
  if (v.includes('cancel')) return 'Cancelled';
  if (v.includes('progress') || v.includes('today')) return 'Today';
  if (v.includes('block')) return 'Today';
  if (v.includes('someday')) return 'Someday';
  return hasWhen ? 'Scheduled' : 'Anytime';
}

async function* iterateDatabase(dbId: string) {
  let cursor: string | undefined = undefined;
  do {
    const res: QueryDatabaseResponse = await enqueue(() =>
      notion.databases.query({ database_id: dbId, start_cursor: cursor, page_size: 50 }),
    );
    for (const page of res.results) {
      if (page.object === 'page' && 'properties' in page) {
        yield page as PageObjectResponse;
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

async function externalIdExists(externalId: string): Promise<boolean> {
  const res = await enqueue(() =>
    notion.databases.query({
      database_id: tasksDbId!,
      filter: { property: 'External ID', rich_text: { equals: externalId } },
      page_size: 1,
    }),
  );
  return res.results.length > 0;
}

async function importFromDb(sourceDbId: string, label: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for await (const page of iterateDatabase(sourceDbId)) {
    const props = page.properties;
    const externalId = `imported:${label}:${page.id}`;
    if (await externalIdExists(externalId)) {
      skipped++;
      continue;
    }
    const name = title(props['Name'] ?? props['Task name']);
    if (!name) {
      skipped++;
      continue;
    }
    const when = dateStart(props['Due']);
    const status = mapStatus(statusName(props['Status']), Boolean(when));

    await enqueue(() =>
      notion.pages.create({
        parent: { database_id: tasksDbId! },
        properties: {
          Name: { title: [{ type: 'text', text: { content: name } }] },
          Status: { select: { name: status } },
          ...(when ? { When: { date: { start: when } } } : {}),
          Source: { select: { name: 'Imported' } },
          'External ID': {
            rich_text: [{ type: 'text', text: { content: externalId } }],
          },
        },
      }),
    );
    created++;
  }
  return { created, skipped };
}

async function main() {
  if (myTasksId) {
    console.log(`Importing from My Tasks (${myTasksId})...`);
    const r = await importFromDb(myTasksId, 'my-tasks');
    console.log(`  created=${r.created} skipped=${r.skipped}`);
  }
  if (trackerId) {
    console.log(`Importing from Task Tracker (${trackerId})...`);
    const r = await importFromDb(trackerId, 'task-tracker');
    console.log(`  created=${r.created} skipped=${r.skipped}`);
  }
  console.log('Done. (Sources were not deleted or archived. Soak for 30 days, then archive manually.)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
