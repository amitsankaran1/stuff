import { NextResponse, type NextRequest } from 'next/server';
import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { auth } from '@/lib/auth';
import { getNotion } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

async function listChecklist(pageId: string): Promise<ChecklistItem[]> {
  const { notion, enqueue } = getNotion();
  const items: ChecklistItem[] = [];
  let cursor: string | undefined;
  do {
    const res: ListBlockChildrenResponse = await enqueue(() =>
      notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 }),
    );
    for (const block of res.results) {
      if (block.object !== 'block') continue;
      const b = block as BlockObjectResponse;
      if (b.type !== 'to_do') continue;
      items.push({
        id: b.id,
        text: b.to_do.rich_text.map((r) => r.plain_text).join(''),
        checked: b.to_do.checked,
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return items;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;
  const items = await listChecklist(id);
  return NextResponse.json({ items }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return new NextResponse('text is required', { status: 400 });

  const { notion, enqueue } = getNotion();
  const res = await enqueue(() =>
    notion.blocks.children.append({
      block_id: id,
      children: [
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: text } }],
            checked: false,
          },
        },
      ],
    }),
  );
  const block = res.results[0] as BlockObjectResponse | undefined;
  if (!block || block.type !== 'to_do') {
    return new NextResponse('append failed', { status: 500 });
  }
  return NextResponse.json(
    {
      item: {
        id: block.id,
        text: block.to_do.rich_text.map((r) => r.plain_text).join(''),
        checked: block.to_do.checked,
      },
    },
    { status: 201 },
  );
}
