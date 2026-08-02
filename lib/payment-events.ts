import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type PaymentEventInput = {
  gateway?: string;
  eventType: string;
  externalEventId?: string | null;
  orderNumber?: string | null;
  paymentReference?: string | null;
  rawPayload?: string | null;
  signatureValid?: boolean | null;
  amountExpected?: number | null;
  amountReceived?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown>;
};

function payloadHash(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Record a gateway webhook/callback. Returns whether this event is new
 * (should be processed) or was already seen.
 */
export async function recordPaymentEvent(
  input: PaymentEventInput
): Promise<{ isNew: boolean; eventId: string | null }> {
  const hash = payloadHash(input.rawPayload);
  const row = {
    gateway: input.gateway || 'stripe',
    event_type: input.eventType,
    external_event_id: input.externalEventId || null,
    order_number: input.orderNumber || null,
    payment_reference: input.paymentReference || null,
    payload_hash: hash,
    signature_valid: input.signatureValid ?? null,
    processing_status: 'received',
    amount_expected: input.amountExpected ?? null,
    amount_received: input.amountReceived ?? null,
    currency: input.currency || null,
    metadata: input.metadata || {},
  };

  const { data, error } = await supabaseAdmin
    .from('payment_events')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (!error && data?.id) {
    return { isNew: true, eventId: data.id };
  }

  // Unique violation → already processed / received
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('duplicate') || msg.includes('unique') || error?.code === '23505') {
    return { isNew: false, eventId: null };
  }

  // Table missing in older envs — do not block payment flow
  if (msg.includes('payment_events') || msg.includes('does not exist')) {
    console.warn('[payment_events] table unavailable; continuing without event log');
    return { isNew: true, eventId: null };
  }

  console.error('[payment_events] insert failed:', error?.message || error);
  return { isNew: true, eventId: null };
}

export async function markPaymentEventProcessed(
  eventId: string | null,
  status: 'processed' | 'ignored' | 'failed',
  errorMessage?: string
) {
  if (!eventId) return;
  await supabaseAdmin
    .from('payment_events')
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
      error_message: errorMessage || null,
    })
    .eq('id', eventId);
}
