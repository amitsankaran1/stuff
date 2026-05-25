import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return new NextResponse('VAPID_PUBLIC_KEY not set', { status: 500 });
  return NextResponse.json({ key });
}
