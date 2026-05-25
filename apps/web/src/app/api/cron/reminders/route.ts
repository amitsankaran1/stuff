import { NextResponse, type NextRequest } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { mapTask } from '@stuff/notion';
import type { Task } from '@stuff/shared';
import { broadcastPush } from '@/lib/broadcast';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { getNotion, TASKS_DB_ID } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEADLINE_WARNING_DAYS = 1;

async function queryAll(filter: Parameters<ReturnType<typeof getNotion>['notion']['databases']['query']>[0]['filter']): Promise<Task[]> {
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

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse('Unauthorized', { status: 401 });
  if (!TASKS_DB_ID) return new NextResponse('NOTION_TASKS_DB_ID not set', { status: 500 });

  const now = new Date();
  const nowIso = now.toISOString();
  const deadlineCutoff = new Date(now.getTime() + DEADLINE_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const deadlineCutoffDate = isoDateOnly(deadlineCutoff);

  // Start-time reminders: tasks with When <= now, not Done/Cancelled, not yet
  // reminded since their When time.
  const startCandidates = await queryAll({
    and: [
      { property: 'When', date: { on_or_before: nowIso } },
      { property: 'Status', select: { does_not_equal: 'Done' } },
      { property: 'Status', select: { does_not_equal: 'Cancelled' } },
    ],
  });

  // Deadline warnings: deadline within the warning window and not yet warned.
  const deadlineCandidates = await queryAll({
    and: [
      { property: 'Deadline', date: { on_or_before: deadlineCutoffDate } },
      { property: 'Deadline', date: { on_or_after: isoDateOnly(now) } },
      { property: 'Status', select: { does_not_equal: 'Done' } },
      { property: 'Status', select: { does_not_equal: 'Cancelled' } },
    ],
  });

  const { notion, enqueue } = getNotion();
  let startSent = 0;
  let deadlineSent = 0;

  for (const t of startCandidates) {
    if (!t.when) continue;
    if (t.lastRemindedAt && new Date(t.lastRemindedAt) >= new Date(t.when)) continue;
    await broadcastPush({
      kind: 'start_reminder',
      taskId: t.id,
      title: t.name,
      body: 'Starting now',
      url: '/today',
    });
    await enqueue(() =>
      notion.pages.update({
        page_id: t.id,
        properties: { 'Last Reminded At': { date: { start: nowIso } } },
      }),
    );
    startSent += 1;
  }

  for (const t of deadlineCandidates) {
    if (!t.deadline) continue;
    // Treat the deadline as a fresh warning trigger: only warn once per day.
    const warnKey = `${t.deadline}`;
    if (t.lastRemindedAt && t.lastRemindedAt.slice(0, 10) >= isoDateOnly(now) && t.lastRemindedAt.slice(0, 10) >= warnKey) {
      continue;
    }
    await broadcastPush({
      kind: 'deadline_warning',
      taskId: t.id,
      title: t.name,
      body: `Deadline ${t.deadline}`,
      url: '/today',
    });
    await enqueue(() =>
      notion.pages.update({
        page_id: t.id,
        properties: { 'Last Reminded At': { date: { start: nowIso } } },
      }),
    );
    deadlineSent += 1;
  }

  return NextResponse.json({
    now: nowIso,
    startCandidates: startCandidates.length,
    startSent,
    deadlineCandidates: deadlineCandidates.length,
    deadlineSent,
  });
}
