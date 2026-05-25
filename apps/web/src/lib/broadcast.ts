import type { PushPayload } from '@stuff/shared';
import { deleteDeviceByPageId, listDevices, touchDevice } from './devices';
import { sendPush } from './push';

export interface BroadcastResult {
  delivered: number;
  pruned: number;
  failed: number;
}

export async function broadcastPush(payload: PushPayload): Promise<BroadcastResult> {
  const devices = await listDevices();
  let delivered = 0;
  let pruned = 0;
  let failed = 0;

  await Promise.all(
    devices.map(async (d) => {
      if (!d.endpoint || !d.keys.p256dh || !d.keys.auth) {
        failed += 1;
        return;
      }
      const res = await sendPush(
        { endpoint: d.endpoint, keys: d.keys },
        payload,
      );
      if (res.ok) {
        delivered += 1;
        touchDevice(d.id).catch(() => {});
      } else if (res.gone) {
        pruned += 1;
        await deleteDeviceByPageId(d.id).catch(() => {});
      } else {
        failed += 1;
      }
    }),
  );

  return { delivered, pruned, failed };
}
