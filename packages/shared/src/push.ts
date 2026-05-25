import { z } from 'zod';

export const PushPayload = z.object({
  kind: z.enum(['start_reminder', 'deadline_warning', 'morning_digest', 'agent_event']),
  taskId: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  url: z.string().optional(),
});
export type PushPayload = z.infer<typeof PushPayload>;

const isoDateTime = z.string().datetime({ offset: true });

export const PushKeys = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
export type PushKeys = z.infer<typeof PushKeys>;

export const DeviceRegistration = z.object({
  deviceId: z.string().min(1),
  endpoint: z.string().url(),
  keys: PushKeys,
  userAgent: z.string().nullable().default(null),
  label: z.string().optional(),
});
export type DeviceRegistration = z.infer<typeof DeviceRegistration>;

export const Device = z.object({
  id: z.string(),
  deviceId: z.string(),
  label: z.string(),
  endpoint: z.string(),
  keys: PushKeys,
  userAgent: z.string().nullable().default(null),
  lastSeenAt: isoDateTime.nullable().default(null),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Device = z.infer<typeof Device>;
