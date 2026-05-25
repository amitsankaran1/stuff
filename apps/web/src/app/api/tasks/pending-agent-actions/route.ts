import { NextResponse } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { mapTask } from '@stuff/notion';
import { auth } from '@/lib/auth';
import { getNotion, TASKS_DB_ID } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!TASKS_DB_ID) return new NextResponse('NOTION_TASKS_DB_ID not set', { status: 500 });

  const { notion, enqueue } = getNotion();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res: QueryDatabaseResponse = await enqueue(() =>
      notion.databases.query({
        database_id: TASKS_DB_ID,
        filter: { property: 'Proposed Status', select: { is_not_empty: true } },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    for (const r of res.results) {
      if (r.object === 'page' && 'properties' in r) pages.push(r as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  const tasks = pages.map(mapTask);
  return NextResponse.json(
    { count: tasks.length, tasks },
    { headers: { 'cache-control': 'no-store' } },
  );
}
