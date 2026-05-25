import { NextResponse, type NextRequest } from 'next/server';
import { DeviceRegistration } from '@stuff/shared';
import { auth } from '@/lib/auth';
import { devicesConfigured, listDevices, upsertDevice } from '@/lib/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!devicesConfigured()) {
    return new NextResponse('NOTION_DEVICES_DB_ID not set', { status: 500 });
  }
  const devices = await listDevices();
  return NextResponse.json(
    { count: devices.length, devices },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!devicesConfigured()) {
    return new NextResponse('NOTION_DEVICES_DB_ID not set', { status: 500 });
  }
  const body = await req.json().catch(() => null);
  const parsed = DeviceRegistration.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const device = await upsertDevice(parsed.data);
  return NextResponse.json({ device }, { status: 201 });
}
