import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { broadcastPush } from '@/lib/broadcast';
import { devicesConfigured } from '@/lib/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!devicesConfigured()) {
    return new NextResponse('NOTION_DEVICES_DB_ID not set', { status: 500 });
  }
  const result = await broadcastPush({
    kind: 'agent_event',
    title: 'Stuff',
    body: 'Test notification — push is working.',
    url: '/today',
  });
  return NextResponse.json(result);
}
