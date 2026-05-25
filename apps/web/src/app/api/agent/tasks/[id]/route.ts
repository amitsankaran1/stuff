import { NextResponse, type NextRequest } from 'next/server';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { buildTaskUpdateProperties, mapTask } from '@stuff/notion';
import { AgentTaskUpdate } from '@stuff/shared';
import { isAuthorizedAgent } from '@/lib/agent-auth';
import { getNotion } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedAgent(req)) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;
  const { notion, enqueue } = getNotion();
  const page = await enqueue(() => notion.pages.retrieve({ page_id: id }));
  return NextResponse.json({ task: mapTask(page as PageObjectResponse) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedAgent(req)) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = AgentTaskUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  // Only forward fields explicitly provided; never status/source.
  const provided = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  const properties = buildTaskUpdateProperties({
    ...provided,
    agentTouchedAt: new Date().toISOString(),
  });

  const { notion, enqueue } = getNotion();
  const updated = await enqueue(() => notion.pages.update({ page_id: id, properties }));
  return NextResponse.json({ task: mapTask(updated as PageObjectResponse) });
}
