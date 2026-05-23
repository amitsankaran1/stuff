import { NextResponse, type NextRequest } from 'next/server';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { buildTaskUpdateProperties, mapTask } from '@stuff/notion';
import { TaskUpdate } from '@stuff/shared';
import { auth } from '@/lib/auth';
import { getNotion } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;
  const { notion, enqueue } = getNotion();
  const page = await enqueue(() => notion.pages.retrieve({ page_id: id }));
  return NextResponse.json({ task: mapTask(page as PageObjectResponse) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = TaskUpdate.safeParse({ ...body, id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  // Only include fields that were actually provided in the body so that
  // omissions don't clear properties.
  const provided = Object.fromEntries(
    Object.entries(parsed.data).filter(([k, v]) => k !== 'id' && v !== undefined),
  );
  const properties = buildTaskUpdateProperties(provided);

  const { notion, enqueue } = getNotion();
  const updated = await enqueue(() => notion.pages.update({ page_id: id, properties }));
  return NextResponse.json({ task: mapTask(updated as PageObjectResponse) });
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;
  const { notion, enqueue } = getNotion();
  await enqueue(() => notion.pages.update({ page_id: id, archived: true }));
  return new NextResponse(null, { status: 204 });
}
