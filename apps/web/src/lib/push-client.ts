const DEVICE_ID_KEY = 'stuff.deviceId';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function subscriptionToRegistration(
  sub: PushSubscription,
  deviceId: string,
): {
  deviceId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
} {
  return {
    deviceId,
    endpoint: sub.endpoint,
    keys: {
      p256dh: bufToB64Url(sub.getKey('p256dh')),
      auth: bufToB64Url(sub.getKey('auth')),
    },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };
}
