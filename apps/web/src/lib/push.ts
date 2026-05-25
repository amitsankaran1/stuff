import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import type { PushPayload } from '@stuff/shared';

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT must be set');
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export interface SendResult {
  ok: boolean;
  gone: boolean;
  statusCode?: number;
}

export async function sendPush(
  subscription: WebPushSubscription,
  payload: PushPayload,
): Promise<SendResult> {
  configure();
  try {
    const res = await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, gone: false, statusCode: res.statusCode };
  } catch (err) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: unknown }).statusCode)
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, gone, statusCode };
  }
}

export type { WebPushSubscription };
