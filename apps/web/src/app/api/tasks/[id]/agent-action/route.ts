import { NextResponse, type NextRequest } from 'next/server';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { buildTaskUpdateProperties, mapTask } from '@stuff/notion';
import { AgentAction } from '@stuff/shared';
import { auth } from '@/lib/auth';
import { getNotion } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = AgentAction.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { notion, enqueue } = getNotion();
  const current = await enqueue(() => notion.pages.retrieve({ page_id: id }));
  const task = mapTask(current as PageObjectResponse);

  if (!task.proposedStatus) {
    return NextResponse.json({ error: 'No proposed status to act on' }, { status: 409 });
  }

  if (parsed.data.action === 'reject') {
    const properties = buildTaskUpdateProperties({ proposedStatus: null });
    const updated = await enqueue(() =>
      notion.pages.update({ page_id: id, properties }),
    );
    return NextResponse.json({ task: mapTask(updated as PageObjectResponse) });
  }

  // confirm: promote proposed → status, clear proposed, stamp completedAt when done.
  const completedAt =
    task.proposedStatus === 'Done' && !task.completedAt
      ? new Date().toISOString()
      : task.proposedStatus !== 'Done'
        ? task.completedAt // leave alone
        : task.completedAt;

  const properties = buildTaskUpdateProperties({
    status: task.proposedStatus,
    proposedStatus: null,
    completedAt: completedAt ?? null,
  });
  const updated = await enqueue(() =>
    notion.pages.update({ page_id: id, properties }),
  );
  return NextResponse.json({ task: mapTask(updated as PageObjectResponse) });
}
