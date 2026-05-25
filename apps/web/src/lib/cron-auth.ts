import type { NextRequest } from 'next/server';

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We also accept
 * the same secret as a query param so a manual curl works in dev.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (header && header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;
  return false;
}
