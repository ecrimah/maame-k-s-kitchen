import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Guest order tracking: requires order_number + email (server-side match).
 * Replaces insecure client-side email checks against openly readable orders.
 */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(
      `order-lookup:${clientId}`,
      RATE_LIMITS.payment
    );
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const orderNumber =
      typeof body?.orderNumber === 'string' ? body.orderNumber.trim() : '';
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!orderNumber || !email) {
      return NextResponse.json(
        { error: 'Order number and email are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(
        `
          id,
          order_number,
          status,
          payment_status,
          total,
          email,
          created_at,
          shipping_address,
          metadata,
          order_items (
            id,
            product_name,
            variant_name,
            quantity,
            unit_price,
            metadata,
            products (
              product_images (url)
            )
          )
        `
      )
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if ((data.email || '').toLowerCase() !== email) {
      return NextResponse.json(
        { error: 'The email address does not match this order' },
        { status: 403 }
      );
    }

    // Do not echo full email back beyond what the customer already knows
    const { email: _email, ...safe } = data;
    return NextResponse.json({ order: { ...safe, email } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    console.error('[orders/lookup]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
