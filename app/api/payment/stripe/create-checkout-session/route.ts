import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getAppBaseUrl, getStripe, toStripeAmount } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`payment:${clientId}`, RATE_LIMITS.payment);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetIn.toString(),
          },
        }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[Stripe] Missing STRIPE_SECRET_KEY');
      return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
    }

    const body = await req.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing or invalid orderId' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const orderQuery = supabaseAdmin
      .from('orders')
      .select('id, order_number, total, email, payment_status, currency, metadata');
    const { data: order, error: orderError } = await (isUuid
      ? orderQuery.eq('id', orderId)
      : orderQuery.eq('order_number', orderId)
    ).maybeSingle();

    if (orderError || !order) {
      console.error('[Stripe] Order not found:', orderId, orderError?.message);
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: false, message: 'Order is already paid' }, { status: 400 });
    }

    const amount = Number(order.total);
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid order amount' }, { status: 400 });
    }

    const orderRef = order.order_number || orderId;
    const baseUrl = getAppBaseUrl(new URL(req.url).origin);
    const stripe = getStripe();
    const currency = (order.currency || 'CAD').toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.email || undefined,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: toStripeAmount(amount),
            product_data: {
              name: `Maame K's Kitchen — Order ${orderRef}`,
              description: 'Online food order',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_number: orderRef,
        order_id: order.id,
      },
      payment_intent_data: {
        metadata: {
          order_number: orderRef,
          order_id: order.id,
        },
      },
      success_url: `${baseUrl}/order-success?order=${encodeURIComponent(orderRef)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pay/${encodeURIComponent(orderRef)}`,
    });

    if (!session.url) {
      return NextResponse.json({ success: false, message: 'Failed to create Stripe checkout session' }, { status: 500 });
    }

    await supabaseAdmin
      .from('orders')
      .update({
        payment_method: 'stripe',
        metadata: {
          ...((order as { metadata?: Record<string, unknown> }).metadata || {}),
          payment_method: 'stripe',
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          payment_attempted_at: new Date().toISOString(),
        },
      })
      .eq('id', order.id);

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[Stripe] Checkout session error:', message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
