import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteDeviceByDeviceId, devicesConfigured } from '@/lib/devices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!devicesConfigured()) {
    return new NextResponse('NOTION_DEVICES_DB_ID not set', { status: 500 });
  }
  const { deviceId } = await params;
  const removed = await deleteDeviceByDeviceId(deviceId);
  if (!removed) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(null, { status: 204 });
}
