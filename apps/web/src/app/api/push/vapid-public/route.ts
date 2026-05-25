import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      console.error('[vapid-public] no session');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const key = process.env.VAPID_PUBLIC_KEY;
    console.error('[vapid-public] key length:', key ? key.length : 'unset');
    if (!key) return new NextResponse('VAPID_PUBLIC_KEY not set', { status: 500 });
    return NextResponse.json({ key });
  } catch (err) {
    console.error('[vapid-public] threw:', err instanceof Error ? err.stack : err);
    return new NextResponse('vapid-public error', { status: 500 });
  }
}
