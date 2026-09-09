import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAppBaseUrl, getStripe } from '@/lib/stripe';
import { ensureStripePlanPrice, getOrCreateStripeCustomer } from '@/lib/stripe-meal-prep';

export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`subscription:${clientId}`, RATE_LIMITS.payment);
    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: 'Too many requests.' }, { status: 429 });
    }

    const auth = await verifyAuth(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, message: 'Please sign in to subscribe.' }, { status: 401 });
    }

    const body = await req.json();
    const { planId, deliveryMethod = 'pickup' } = body;

    if (!planId || typeof planId !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing planId' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('meal_prep_subscriptions')
      .select('id, status')
      .eq('user_id', auth.user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'You already have an active meal-prep subscription.' },
        { status: 400 }
      );
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('status', 'active')
      .single();

    if (planError || !plan) {
      return NextResponse.json({ success: false, message: 'Plan not found' }, { status: 404 });
    }

    let stripe_price_id = plan.stripe_price_id as string | null;
    if (!stripe_price_id) {
      try {
        const synced = await ensureStripePlanPrice(plan);
        stripe_price_id = synced.stripe_price_id;
      } catch (syncErr: unknown) {
        const message = syncErr instanceof Error ? syncErr.message : 'Stripe sync failed';
        console.error('[subscriptions/create-checkout] Stripe plan sync failed:', message);
        return NextResponse.json(
          { success: false, message: 'This plan is not available for checkout yet. Please try again later.' },
          { status: 400 }
        );
      }
    }
    const customerId = await getOrCreateStripeCustomer(
      auth.user.id,
      auth.user.email || '',
      auth.user.user_metadata?.full_name
    );

    const baseUrl = getAppBaseUrl(new URL(req.url).origin);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripe_price_id, quantity: 1 }],
      metadata: {
        type: 'meal_prep',
        user_id: auth.user.id,
        plan_id: plan.id,
        delivery_method: deliveryMethod,
      },
      subscription_data: {
        metadata: {
          type: 'meal_prep',
          user_id: auth.user.id,
          plan_id: plan.id,
        },
      },
      success_url: `${baseUrl}/meal-prep/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/meal-prep?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json({ success: false, message: 'Failed to start checkout' }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[Subscription Checkout]', message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
