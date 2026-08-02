-- Staging DB hardening for plain-Postgres cutover (Maame K's Kitchen)
-- Safe / additive. Apply to store_maameks and maame_staging.
-- Does not drop data.

-- ---------------------------------------------------------------------------
-- 1) Contact + newsletter tables expected by app code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_submissions_status_check
    CHECK (status IN ('new', 'read', 'replied', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
  ON public.contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email
  ON public.contact_submissions (lower(email));

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email),
  CONSTRAINT newsletter_subscribers_status_check
    CHECK (status IN ('active', 'unsubscribed', 'bounced'))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status
  ON public.newsletter_subscribers (status);

-- ---------------------------------------------------------------------------
-- 2) Payment / webhook / SMS event tables (Stripe + Moolre SMS)
-- Hubtel/Paystack not used by this store.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL DEFAULT 'stripe',
  event_type text NOT NULL,
  external_event_id text,
  order_number text,
  payment_reference text,
  payload_hash text,
  signature_valid boolean,
  processing_status text NOT NULL DEFAULT 'received',
  attempt_count integer NOT NULL DEFAULT 1,
  error_message text,
  amount_expected numeric,
  amount_received numeric,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT payment_events_status_check
    CHECK (processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
  CONSTRAINT payment_events_attempt_nonneg CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_external
  ON public.payment_events (gateway, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_payload_hash
  ON public.payment_events (gateway, payload_hash)
  WHERE payload_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_order
  ON public.payment_events (order_number);
CREATE INDEX IF NOT EXISTS idx_payment_events_status
  ON public.payment_events (processing_status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'moolre',
  recipient_masked text NOT NULL,
  recipient_hash text,
  message_type text NOT NULL,
  template_name text,
  related_user_id uuid,
  related_order_number text,
  related_payment_ref text,
  provider_message_id text,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  CONSTRAINT sms_messages_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'skipped')),
  CONSTRAINT sms_messages_attempt_nonneg CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_idempotency
  ON public.sms_messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_order
  ON public.sms_messages (related_order_number);
CREATE INDEX IF NOT EXISTS idx_sms_status
  ON public.sms_messages (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Helpful indexes for payment lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id
  ON public.orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) Idempotent mark_order_paid + store Stripe/payment ref on the row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_order orders;
BEGIN
  -- Already paid: return current row (idempotent)
  SELECT * INTO updated_order
  FROM orders
  WHERE order_number = order_ref
    AND payment_status = 'paid'::payment_status;

  IF FOUND THEN
    RETURN to_jsonb(updated_order);
  END IF;

  UPDATE orders
  SET
    payment_status = 'paid',
    payment_transaction_id = COALESCE(NULLIF(moolre_ref, ''), payment_transaction_id),
    status = CASE
      WHEN status = 'pending' THEN 'processing'::order_status
      WHEN status = 'awaiting_payment' THEN 'processing'::order_status
      ELSE status
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'moolre_reference', moolre_ref,
        'payment_verified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ),
    updated_at = now()
  WHERE order_number = order_ref
    AND payment_status IS DISTINCT FROM 'paid'::payment_status
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL THEN
    IF (updated_order.metadata->>'stock_reduced') IS NULL THEN
      UPDATE products p
      SET quantity = GREATEST(0, p.quantity - oi.quantity)
      FROM order_items oi
      WHERE oi.order_id = updated_order.id
        AND oi.product_id = p.id;

      UPDATE product_variants pv
      SET quantity = GREATEST(0, pv.quantity - oi.quantity)
      FROM order_items oi
      WHERE oi.order_id = updated_order.id
        AND oi.product_id = pv.product_id
        AND oi.variant_name IS NOT NULL
        AND oi.variant_name = pv.name;

      UPDATE orders
      SET metadata = metadata || '{"stock_reduced": true}'::jsonb
      WHERE id = updated_order.id
      RETURNING * INTO updated_order;
    END IF;
  ELSE
    SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Minimal store_modules seed (admin layout reads this)
-- ---------------------------------------------------------------------------
INSERT INTO public.store_modules (id, enabled)
VALUES
  ('products', true),
  ('orders', true),
  ('customers', true),
  ('coupons', true),
  ('reviews', true),
  ('subscriptions', true),
  ('events', true),
  ('pos', true),
  ('analytics', true),
  ('notifications', true)
ON CONFLICT (id) DO NOTHING;
