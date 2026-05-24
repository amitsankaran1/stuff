import { NextResponse, type NextRequest } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { mapArea } from '@stuff/notion';
import { auth } from '@/lib/auth';
import { getNotion, AREAS_DB_ID } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!AREAS_DB_ID) return new NextResponse('NOTION_AREAS_DB_ID not set', { status: 500 });

  const { notion, enqueue } = getNotion();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res: QueryDatabaseResponse = await enqueue(() =>
      notion.databases.query({
        database_id: AREAS_DB_ID,
        sorts: [{ property: 'Name', direction: 'ascending' }],
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    for (const r of res.results) {
      if (r.object === 'page' && 'properties' in r) pages.push(r as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const areas = pages.map(mapArea);
  return NextResponse.json(
    { count: areas.length, areas },
    { headers: { 'cache-control': 'no-store' } },
  );
}
