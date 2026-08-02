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
import {
  markPaymentEventProcessed,
  recordPaymentEvent,
} from '@/lib/payment-events';
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

  let event: Stripe.Event;
  let payload: string;

  try {
    const stripe = getStripe();
    payload = await req.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid webhook payload';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const sessionPreview =
    event.type === 'checkout.session.completed'
      ? (event.data.object as Stripe.Checkout.Session)
      : null;

  const { isNew, eventId } = await recordPaymentEvent({
    gateway: 'stripe',
    eventType: event.type,
    externalEventId: event.id,
    orderNumber: sessionPreview?.metadata?.order_number || null,
    paymentReference:
      (typeof sessionPreview?.payment_intent === 'string' && sessionPreview.payment_intent) ||
      sessionPreview?.id ||
      null,
    rawPayload: payload,
    signatureValid: true,
    amountReceived:
      sessionPreview?.amount_total != null ? sessionPreview.amount_total / 100 : null,
    currency: sessionPreview?.currency || null,
  });

  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === 'subscription' && session.metadata?.type === 'meal_prep') {
        await fulfillSubscriptionCheckout(session);
        await markPaymentEventProcessed(eventId, 'processed');
        console.log('[Stripe Webhook] Meal-prep subscription activated:', session.id);
        return NextResponse.json({ received: true });
      }

      const orderNumber = session.metadata?.order_number;

      if (!orderNumber) {
        console.warn('[Stripe Webhook] checkout.session.completed without order_number metadata');
        await markPaymentEventProcessed(eventId, 'ignored', 'missing order_number');
        return NextResponse.json({ received: true });
      }

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('payment_status, total')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (order?.payment_status === 'paid') {
        await markPaymentEventProcessed(eventId, 'ignored', 'order already paid');
        return NextResponse.json({ received: true });
      }

      if (session.payment_status !== 'paid') {
        console.warn('[Stripe Webhook] Session completed but payment_status is not paid:', session.id);
        await markPaymentEventProcessed(eventId, 'ignored', 'session not paid');
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
          await markPaymentEventProcessed(eventId, 'failed', 'amount mismatch');
          return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
        }
      }

      const paymentRef =
        (typeof session.payment_intent === 'string' && session.payment_intent) ||
        session.id;

      await fulfillOrderPayment(orderNumber, paymentRef);
      await markPaymentEventProcessed(eventId, 'processed');
      console.log('[Stripe Webhook] Order fulfilled:', orderNumber);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(subscription);
      await markPaymentEventProcessed(eventId, 'processed');
      console.log('[Stripe Webhook] Subscription synced:', subscription.id, subscription.status);
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getInvoiceSubscriptionId(invoice);
      if (subId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create')) {
        await handleSubscriptionInvoicePaid(invoice);
        await markPaymentEventProcessed(eventId, 'processed');
        console.log('[Stripe Webhook] Subscription invoice fulfilled:', invoice.id);
      } else {
        await markPaymentEventProcessed(eventId, 'ignored', 'invoice not a subscription cycle');
      }
    }

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'customer.subscription.updated' &&
      event.type !== 'customer.subscription.deleted' &&
      event.type !== 'invoice.paid'
    ) {
      await markPaymentEventProcessed(eventId, 'ignored', 'unhandled event type');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed';
    console.error('[Stripe Webhook] Handler error:', message);
    await markPaymentEventProcessed(eventId, 'failed', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
