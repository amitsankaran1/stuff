import { NextResponse, type NextRequest } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { mapTask } from '@stuff/notion';
import { auth } from '@/lib/auth';
import { getNotion, TASKS_DB_ID } from '@/lib/notion';
import { filterForView, isViewKey } from '@/lib/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!TASKS_DB_ID) return new NextResponse('NOTION_TASKS_DB_ID not set', { status: 500 });

  const url = new URL(req.url);
  const viewParam = url.searchParams.get('view') ?? 'inbox';
  if (!isViewKey(viewParam)) {
    return new NextResponse(`Unknown view: ${viewParam}`, { status: 400 });
  }

  const { notion, enqueue } = getNotion();
  const { filter, sorts } = filterForView(viewParam);

  const all: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const params: QueryDatabaseParameters = {
      database_id: TASKS_DB_ID,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: 100,
    };
    const res: QueryDatabaseResponse = await enqueue(() => notion.databases.query(params));
    for (const r of res.results) {
      if (r.object === 'page' && 'properties' in r) all.push(r as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const tasks = all.map(mapTask);
  return NextResponse.json(
    { view: viewParam, count: tasks.length, tasks },
    { headers: { 'cache-control': 'no-store' } },
  );
}
