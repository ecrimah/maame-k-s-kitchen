import { NextResponse } from 'next/server';
import { isPlainPostgres } from '@/lib/db/mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Lightweight health check — does not expose secrets.
 */
export async function GET() {
  const checks: Record<string, string> = {
    app: 'ok',
    plainPostgres: isPlainPostgres() ? 'configured' : 'not_configured',
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing',
    stripeWebhook: process.env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'missing',
    email: process.env.RESEND_API_KEY ? 'configured' : 'missing',
    sms: process.env.MOOLRE_SMS_API_KEY || process.env.MOOLRE_API_KEY
      ? 'configured'
      : 'missing',
    authSecret:
      process.env.AUTH_JWT_SECRET ||
      process.env.JWT_SECRET ||
      process.env.SUPABASE_JWT_SECRET
        ? 'configured'
        : 'missing',
  };

  let db: 'ok' | 'error' | 'skipped' = 'skipped';
  if (isPlainPostgres()) {
    try {
      const { query } = await import('@/lib/db/pool');
      await query('SELECT 1 AS ok');
      db = 'ok';
    } catch {
      db = 'error';
    }
  }

  const healthy = db !== 'error';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      db,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
