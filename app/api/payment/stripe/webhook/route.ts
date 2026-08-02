import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fulfillOrderPayment } from '@/lib/fulfill-order-payment';
import {
  fulfillSubscriptionCheckout,
  handleSubscriptionInvoicePaid,
  syncSubscriptionFromStripe,
} from '@/lib/fulfill-subscription';
import { getStripe } from '@/lib/stripe';
import { getInvoiceSubscriptionId } from '@/lib/stripe-subscription-helpers';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;

  try {
    const stripe = getStripe();
    const payload = await req.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid webhook payload';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === 'subscription' && session.metadata?.type === 'meal_prep') {
        await fulfillSubscriptionCheckout(session);
        console.log('[Stripe Webhook] Meal-prep subscription activated:', session.id);
        return NextResponse.json({ received: true });
      }

      const orderNumber = session.metadata?.order_number;

      if (!orderNumber) {
        console.warn('[Stripe Webhook] checkout.session.completed without order_number metadata');
        return NextResponse.json({ received: true });
      }

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('payment_status, total')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (order?.payment_status === 'paid') {
        return NextResponse.json({ received: true });
      }

      if (session.payment_status !== 'paid') {
        console.warn('[Stripe Webhook] Session completed but payment_status is not paid:', session.id);
        return NextResponse.json({ received: true });
      }

      if (order?.total != null && session.amount_total != null) {
        const expectedAmount = Math.round(Number(order.total) * 100);
        if (session.amount_total !== expectedAmount) {
          console.error(
            '[Stripe Webhook] Amount mismatch for',
            orderNumber,
            'expected',
            expectedAmount,
            'got',
            session.amount_total
          );
          return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
        }
      }

      const paymentRef =
        (typeof session.payment_intent === 'string' && session.payment_intent) ||
        session.id;

      await fulfillOrderPayment(orderNumber, paymentRef);
      console.log('[Stripe Webhook] Order fulfilled:', orderNumber);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(subscription);
      console.log('[Stripe Webhook] Subscription synced:', subscription.id, subscription.status);
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getInvoiceSubscriptionId(invoice);
      if (subId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create')) {
        await handleSubscriptionInvoicePaid(invoice);
        console.log('[Stripe Webhook] Subscription invoice fulfilled:', invoice.id);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed';
    console.error('[Stripe Webhook] Handler error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
