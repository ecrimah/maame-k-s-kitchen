import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Limited fields for the /pay/[orderId] page.
 * Accepts UUID id or order_number. Does not expose full PII.
 */
export async function GET(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(
      `order-pay-info:${clientId}`,
      RATE_LIMITS.payment
    );
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const url = new URL(req.url);
    const ref = (url.searchParams.get('ref') || '').trim();
    if (!ref) {
      return NextResponse.json({ error: 'Missing ref' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('orders')
      .select(
        'id, order_number, status, payment_status, total, currency, created_at'
      );

    if (UUID_RE.test(ref)) {
      query = query.eq('id', ref);
    } else {
      query = query.eq('order_number', ref);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Pay info failed';
    console.error('[orders/pay-info]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
