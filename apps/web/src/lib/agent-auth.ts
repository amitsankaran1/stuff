import type { NextRequest } from 'next/server';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Agent API auth. Looks for `Authorization: Bearer <AGENT_TOKEN>`. We use a
 * separate token from CRON_SECRET so the two surfaces can be revoked
 * independently and so agent tokens never grant cron-trigger capability.
 */
export function isAuthorizedAgent(req: NextRequest): boolean {
  const expected = process.env.AGENT_TOKEN ?? '';
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return false;
  return constantTimeEqual(token, expected);
}
