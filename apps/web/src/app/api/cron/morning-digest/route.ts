import { NextResponse, type NextRequest } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { mapTask } from '@stuff/notion';
import type { Task } from '@stuff/shared';
import { broadcastPush } from '@/lib/broadcast';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { getNotion, TASKS_DB_ID } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function queryAll(filter: QueryDatabaseParameters['filter']): Promise<Task[]> {
  const { notion, enqueue } = getNotion();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res: QueryDatabaseResponse = await enqueue(() =>
      notion.databases.query({
        database_id: TASKS_DB_ID,
        filter,
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    for (const r of res.results) {
      if (r.object === 'page' && 'properties' in r) pages.push(r as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages.map(mapTask);
}

function localDateISO(tz: string): string {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse('Unauthorized', { status: 401 });
  if (!TASKS_DB_ID) return new NextResponse('NOTION_TASKS_DB_ID not set', { status: 500 });

  const tz = process.env.USER_TZ || 'America/Los_Angeles';
  const today = localDateISO(tz);

  const [todayTasks, inboxTasks, overdue] = await Promise.all([
    queryAll({
      and: [
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Status', status: { does_not_equal: 'Cancelled' } },
        {
          or: [
            { property: 'Status', status: { equals: 'Today' } },
            { property: 'When', date: { on_or_before: today } },
          ],
        },
      ],
    }),
    queryAll({ property: 'Status', status: { equals: 'Inbox' } }),
    queryAll({
      and: [
        { property: 'Deadline', date: { before: today } },
        { property: 'Status', status: { does_not_equal: 'Done' } },
        { property: 'Status', status: { does_not_equal: 'Cancelled' } },
      ],
    }),
  ]);

  const parts: string[] = [];
  parts.push(`${todayTasks.length} due today`);
  if (inboxTasks.length) parts.push(`${inboxTasks.length} in inbox`);
  if (overdue.length) parts.push(`${overdue.length} overdue`);

  const result = await broadcastPush({
    kind: 'morning_digest',
    title: 'Good morning',
    body: parts.join(' · '),
    url: '/today',
  });

  return NextResponse.json({
    today,
    tz,
    today_count: todayTasks.length,
    inbox_count: inboxTasks.length,
    overdue_count: overdue.length,
    ...result,
  });
}
