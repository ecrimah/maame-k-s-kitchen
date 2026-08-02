# Payment Database Audit

**Project:** Maame K's Kitchen  
**Report date:** 2026-08-02  
**Gateway:** **Stripe only** (CAD Checkout + Billing for meal prep)

---

## Scope Exclusions

| Gateway / service | Status in codebase | DB artifacts |
|-------------------|-------------------|--------------|
| **Stripe** | Active — orders + subscriptions | `orders`, `payment_events`, RPCs |
| **Moolre** | SMS notifications only | `sms_messages` (audit schema; no payment columns) |
| **Hubtel** | **Not implemented** | **N/A** — no tables, no RPCs, no env vars |
| **Paystack** | **Not implemented** | **N/A** — no tables, no RPCs, no env vars |

Do not document or provision Hubtel/Paystack payment tables for this store.

---

## Payment Architecture

```
Customer checkout
       │
       ▼
Stripe Checkout Session (metadata.order_number)
       │
       ▼
POST /api/payment/stripe/webhook
       │
       ├── recordPaymentEvent() → payment_events (idempotency)
       │
       ├── Amount validation (session.amount_total vs orders.total)
       │
       └── fulfillOrderPayment()
              ├── RPC mark_order_paid(order_ref, moolre_ref)
              ├── Coupon usage increment (orders.metadata.coupon_id)
              ├── RPC update_customer_stats(email, total)
              └── sendOrderConfirmation() (email + optional SMS)
```

**Meal-prep path:** `checkout.session.completed` with `mode=subscription` → `fulfillSubscriptionCheckout()` — updates `meal_prep_subscriptions`, not `mark_order_paid`.

---

## Legacy Naming: `moolre_ref`

The RPC signature predates the Stripe-only decision:

```sql
mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL)
```

| Name | Actual content |
|------|----------------|
| `moolre_ref` (RPC arg) | Stripe Payment Intent id or Checkout Session id |
| `orders.payment_transaction_id` | Set from `moolre_ref` when non-empty |
| `orders.metadata.moolre_reference` | JSON duplicate for audit trail |
| `orders.metadata.payment_verified_at` | UTC timestamp on first paid transition |

**Moolre** in this codebase refers exclusively to the **SMS API provider**, not payment processing.

---

## Orders Table (Payment Columns)

### `public.orders`

| Column | Type | Purpose |
|--------|------|---------|
| `payment_status` | `payment_status` enum | `pending`, `paid`, `failed`, `refunded` |
| `payment_method` | text | e.g. `stripe` |
| `payment_provider` | text | Provider label |
| `payment_transaction_id` | text | Stripe reference (indexed) |
| `currency` | text | Default **CAD** |
| `total` | numeric | Validated against Stripe `amount_total` (cents) |
| `metadata` | jsonb | `coupon_id`, `stock_reduced`, payment audit keys |
| `payment_reminder_sent` | boolean | Cron reminder flag |

### Audit snapshot (2026-08-02)

| `payment_status` | Count |
|------------------|-------|
| paid | 4 |
| pending | 27 |
| failed / refunded | 0 (at audit) |

No orders with negative totals were found.

**Indexes (hardening migration):**

- `idx_orders_payment_status`
- `idx_orders_payment_transaction_id` (partial, WHERE NOT NULL)
- `idx_orders_created_at` (DESC)

---

## `payment_events` Table

Created by `20260802000000_staging_db_hardening.sql`. Implements webhook idempotency and forensic audit.

### Schema

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `gateway` | text | Default `'stripe'` |
| `event_type` | text | e.g. `checkout.session.completed` |
| `external_event_id` | text | Stripe event id (`evt_...`) |
| `order_number` | text | From session metadata |
| `payment_reference` | text | Payment intent or session id |
| `payload_hash` | text | SHA-256 of raw webhook body |
| `signature_valid` | boolean | Set true after Stripe verification |
| `processing_status` | text | received → processed / ignored / failed |
| `attempt_count` | integer | Retry tracking |
| `error_message` | text | Failure reason |
| `amount_expected` / `amount_received` | numeric | Optional reconciliation |
| `currency` | text | |
| `metadata` | jsonb | Extensibility |
| `received_at` / `processed_at` | timestamptz | |

### Uniqueness constraints

| Index | Purpose |
|-------|---------|
| `uq_payment_events_external (gateway, external_event_id)` | Stripe event id dedup |
| `uq_payment_events_payload_hash (gateway, payload_hash)` | Body hash dedup |

Duplicate inserts return PostgreSQL `23505`; `recordPaymentEvent()` treats as already-seen and returns `{ isNew: false }`.

### Application flow (`lib/payment-events.ts`)

1. **Insert** row with `processing_status = 'received'`
2. If duplicate → webhook responds `{ duplicate: true }` without re-processing
3. On success → `markPaymentEventProcessed(id, 'processed')`
4. On benign skip → `'ignored'` (missing order_number, already paid, etc.)
5. On amount mismatch → `'failed'` + HTTP 400

**Graceful degradation:** If table missing (pre-hardening env), payment still proceeds with console warning.

---

## RPC: `mark_order_paid` (v2 — Idempotent)

Replaced during hardening. Key behaviors:

### Idempotency

```sql
-- If already paid, return existing row without side effects
SELECT * FROM orders
WHERE order_number = order_ref AND payment_status = 'paid';
```

Safe for Stripe webhook retries and duplicate deliveries.

### State transitions

| Field | Change on first paid |
|-------|---------------------|
| `payment_status` | → `paid` |
| `status` | `pending` / `awaiting_payment` → `processing` |
| `payment_transaction_id` | COALESCE(stripe ref, existing) |
| `metadata` | Adds `moolre_reference`, `payment_verified_at` |

### Stock reduction

Runs once per order when `metadata.stock_reduced` is absent:

1. Decrement `products.quantity` by line quantities
2. Decrement matching `product_variants.quantity` (match on `variant_name`)
3. Set `metadata.stock_reduced = true`

Uses `GREATEST(0, ...)` to prevent negative inventory.

### Caller

`lib/fulfill-order-payment.ts`:

```typescript
await supabaseAdmin.rpc('mark_order_paid', {
  order_ref: orderNumber,
  moolre_ref: paymentRef,  // Stripe reference
});
```

---

## Stripe Webhook Events (Database Effects)

| Stripe event | DB writes |
|--------------|-----------|
| `checkout.session.completed` (payment mode) | `payment_events`, `mark_order_paid`, coupon, customer stats |
| `checkout.session.completed` (subscription / meal_prep) | `payment_events`, `meal_prep_subscriptions`, profile stripe ids |
| `customer.subscription.updated` | `meal_prep_subscriptions.status`, period dates |
| `customer.subscription.deleted` | Subscription canceled |
| `invoice.paid` | Meal-prep renewal period update |

Webhook env: `STRIPE_WEBHOOK_SECRET` (required for signature verification).

---

## Related RPCs (Non-Stripe Gateway)

| RPC | When called | Payment role |
|-----|-------------|--------------|
| `upsert_customer_from_order` | Checkout (public RPC) | CRM only |
| `update_customer_stats` | After `mark_order_paid` | CRM aggregates |
| `reduce_stock_on_order` | Manual admin | Stock without payment |

---

## SMS (`sms_messages`) — Not a Payment Channel

Table exists for outbound SMS audit (Moolre). Columns like `related_payment_ref` link notifications to Stripe refs for support lookups — **not** payment authorization.

Expected future insert pattern:

- Mask phone in `recipient_masked`
- Hash phone in `recipient_hash`
- `idempotency_key` for dedup
- `message_type`: order_confirmation, payment_reminder, etc.

At audit time, app sends SMS via API without persisting to `sms_messages`.

---

## Security Controls

| Control | Implementation |
|---------|----------------|
| Webhook signature | Stripe `constructEvent()` |
| Amount tampering | Compare `session.amount_total` to `orders.total * 100` |
| Replay attacks | `payment_events` unique indexes |
| Double stock decrement | `metadata.stock_reduced` flag |
| Double paid transition | Idempotent `mark_order_paid` early return |
| REST RPC access | `mark_order_paid` in STAFF_RPC set — blocked for anon JWT |

---

## Verification Queries

Run on VPS with placeholders:

```sql
-- Payment status distribution
SELECT payment_status, count(*) FROM orders GROUP BY 1;

-- Recent payment events
SELECT event_type, processing_status, order_number, received_at
FROM payment_events
ORDER BY received_at DESC
LIMIT 20;

-- Paid orders missing transaction id (legacy)
SELECT order_number, created_at
FROM orders
WHERE payment_status = 'paid'
  AND (payment_transaction_id IS NULL OR payment_transaction_id = '');

-- Idempotency index presence
SELECT indexname FROM pg_indexes
WHERE tablename = 'payment_events';
```

---

## Recommendations

| Priority | Item |
|----------|------|
| Medium | Wire SMS sends to insert `sms_messages` rows |
| Low | Rename RPC arg `moolre_ref` → `payment_ref` in coordinated migration |
| Deploy | Update Stripe webhook URL when Coolify app goes live |
| Deploy | Run test-mode checkout against `maame_staging` DB before prod cutover |

---

## Related Documents

- [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) — column details
- [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md) — integrity results
- [SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) — Stripe env vars
