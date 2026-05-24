import { NextResponse, type NextRequest } from 'next/server';
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { mapArea, mapProject } from '@stuff/notion';
import { auth } from '@/lib/auth';
import { getNotion, PROJECTS_DB_ID } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!PROJECTS_DB_ID) return new NextResponse('NOTION_PROJECTS_DB_ID not set', { status: 500 });
  const { id } = await ctx.params;

  const { notion, enqueue } = getNotion();

  const [pagePromise, projectsPromise] = [
    enqueue(() => notion.pages.retrieve({ page_id: id })),
    (async () => {
      const all: PageObjectResponse[] = [];
      let cursor: string | undefined;
      do {
        const res: QueryDatabaseResponse = await enqueue(() =>
          notion.databases.query({
            database_id: PROJECTS_DB_ID,
            filter: { property: 'Area', relation: { contains: id } },
            sorts: [{ property: 'Name', direction: 'ascending' }],
            start_cursor: cursor,
            page_size: 100,
          }),
        );
        for (const r of res.results) {
          if (r.object === 'page' && 'properties' in r) all.push(r as PageObjectResponse);
        }
        cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
      } while (cursor);
      return all;
    })(),
  ];
  const [page, projectPages] = await Promise.all([pagePromise, projectsPromise]);

  return NextResponse.json({
    area: mapArea(page as PageObjectResponse),
    projects: projectPages.map(mapProject),
  });
}
