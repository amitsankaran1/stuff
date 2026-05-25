import { NextResponse, type NextRequest } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { buildTaskCreatePayload, mapTask } from '@stuff/notion';
import { iterationKey, nextOccurrence } from '@stuff/shared';
import type { Task, TaskCreate } from '@stuff/shared';
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

async function existsByExternalId(externalId: string): Promise<boolean> {
  const { notion, enqueue } = getNotion();
  const res: QueryDatabaseResponse = await enqueue(() =>
    notion.databases.query({
      database_id: TASKS_DB_ID,
      filter: { property: 'External ID', rich_text: { equals: externalId } },
      page_size: 1,
    }),
  );
  return res.results.length > 0;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new NextResponse('Unauthorized', { status: 401 });
  if (!TASKS_DB_ID) return new NextResponse('NOTION_TASKS_DB_ID not set', { status: 500 });

  // Candidates: Done tasks that have a Recurrence rrule set. We compute the
  // next occurrence after completion and spawn a Scheduled copy.
  const candidates = await queryAll({
    and: [
      { property: 'Status', select: { equals: 'Done' } },
      { property: 'Recurrence', rich_text: { is_not_empty: true } },
    ],
  });

  const { notion, enqueue } = getNotion();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const t of candidates) {
    if (!t.recurrence) continue;
    const after = t.completedAt ? new Date(t.completedAt) : new Date();
    let next: Date | null;
    try {
      next = nextOccurrence(t.recurrence, after);
    } catch (err) {
      errors.push(`${t.id}: bad rrule (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (!next) {
      skipped += 1;
      continue;
    }
    const key = iterationKey(t.id, next);
    if (await existsByExternalId(key)) {
      skipped += 1;
      continue;
    }
    const payload: TaskCreate = {
      name: t.name,
      status: 'Scheduled',
      when: next.toISOString(),
      deadline: t.deadline,
      projectId: t.projectId,
      areaId: t.areaId,
      heading: t.heading,
      tags: t.tags,
      recurrence: t.recurrence,
      source: 'User',
      externalId: key,
    };
    const res = await enqueue(() =>
      notion.pages.create(buildTaskCreatePayload(TASKS_DB_ID, payload)),
    );
    // Touch the result so the loop doesn't keep recreating it if rerun.
    mapTask(res as PageObjectResponse);
    created += 1;
  }

  return NextResponse.json({
    candidates: candidates.length,
    created,
    skipped,
    errors,
  });
}
