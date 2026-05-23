import { z } from 'zod';

export const PushPayload = z.object({
  kind: z.enum(['start_reminder', 'deadline_warning', 'morning_digest', 'agent_event']),
  taskId: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  url: z.string().optional(),
});
export type PushPayload = z.infer<typeof PushPayload>;

export const PushSubscriptionRecord = z.object({
  deviceId: z.string(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  createdAt: z.string().datetime({ offset: true }),
});
export type PushSubscriptionRecord = z.infer<typeof PushSubscriptionRecord>;
