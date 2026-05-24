import { NextResponse, type NextRequest } from 'next/server';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { auth } from '@/lib/auth';
import { getNotion } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { itemId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const patch: { text?: string; checked?: boolean } = {};
  if (typeof body?.text === 'string') patch.text = body.text;
  if (typeof body?.checked === 'boolean') patch.checked = body.checked;

  if (patch.text === undefined && patch.checked === undefined) {
    return new NextResponse('nothing to update', { status: 400 });
  }

  const { notion, enqueue } = getNotion();
  const updated = await enqueue(() =>
    notion.blocks.update({
      block_id: itemId,
      to_do: {
        ...(patch.text !== undefined
          ? { rich_text: [{ type: 'text', text: { content: patch.text } }] }
          : {}),
        ...(patch.checked !== undefined ? { checked: patch.checked } : {}),
      },
    }),
  );
  const b = updated as BlockObjectResponse;
  if (b.type !== 'to_do') return new NextResponse('not a to_do block', { status: 400 });
  return NextResponse.json({
    item: {
      id: b.id,
      text: b.to_do.rich_text.map((r) => r.plain_text).join(''),
      checked: b.to_do.checked,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { itemId } = await ctx.params;
  const { notion, enqueue } = getNotion();
  await enqueue(() => notion.blocks.delete({ block_id: itemId }));
  return new NextResponse(null, { status: 204 });
}
