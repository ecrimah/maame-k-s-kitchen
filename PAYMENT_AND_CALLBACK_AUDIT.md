# Payment and Callback Audit

**Project:** Maame K's Kitchen — Calgary, Canada  
**Audit date:** 2026-08-02  
**Branch:** `staging/plain-postgres`

---

## Payment Gateway Inventory

| Gateway | Implemented | Role in this project |
|---------|-------------|---------------------|
| **Stripe Checkout** | ✅ Yes | One-time food orders (CAD) |
| **Stripe Billing** | ✅ Yes | Meal-prep weekly subscriptions |
| **Hubtel** | ❌ No | **Not in codebase** — do not configure |
| **Paystack** | ❌ No | **Not in codebase** — do not configure |
| **Moolre payments** | ❌ No | **Not used for checkout** |
| **Moolre SMS** | ✅ Yes | Order/payment SMS notifications only |
| **Cash on delivery (COD)** | ✅ Yes | No gateway; order created as pending, notifications sent |

> **Historical naming:** The Postgres function `mark_order_paid(order_ref text, moolre_ref text)` accepts a second argument named `moolre_ref` from an older template. In this project it stores **Stripe payment intent IDs or Checkout session IDs**, not Moolre payment references.

---

## Stripe — One-Time Order Flow

### Sequence diagram

```
Customer                Checkout Page           API                     Stripe              Webhook
   │                         │                   │                        │                    │
   │── fill cart + submit ──►│                   │                        │                    │
   │                         │── insert order ──►│ (supabase REST/RPC)    │                    │
   │                         │── POST create ───►│/api/payment/stripe/    │                    │
   │                         │   checkout-session│                        │                    │
   │                         │                   │── sessions.create ────►│                    │
   │                         │◄── session URL ───│                        │                    │
   │                         │── clearCart() ────│                        │                    │
   │◄── redirect ────────────│                   │                        │                    │
   │─────────────────────────────────────────────►│ Stripe Checkout UI     │                    │
   │                         │                   │                        │── session.completed│
   │                         │                   │                        │───────────────────►│
   │                         │                   │                        │                    │── amount check
   │                         │                   │                        │                    │── fulfillOrderPayment
   │                         │                   │                        │                    │── mark_order_paid RPC
   │◄── redirect success ────│                   │                        │                    │
   │── order-success page ──►│                   │                        │                    │
   │                         │── (optional) ────►│/api/payment/stripe/verify                    │
```

### Step-by-step

1. **Order creation** (`app/(store)/checkout/page.tsx`)
   - Customer submits checkout form.
   - Order + order_items inserted via client `supabase` (REST shim).
   - `upsert_customer_from_order` RPC called.
   - If `paymentMethod === 'stripe'`, calls `/api/payment/stripe/create-checkout-session`.

2. **Checkout session creation** (`app/api/payment/stripe/create-checkout-session/route.ts`)
   - Loads order by UUID or `order_number` via `supabaseAdmin`.
   - Rejects if already paid or amount ≤ 0.
   - Creates Stripe Checkout `mode: 'payment'` with:
     - `metadata.order_number`, `metadata.order_id`
     - `success_url`: `/order-success?order={order_number}&session_id={CHECKOUT_SESSION_ID}`
     - `cancel_url`: `/pay/{order_number}`
   - Updates order metadata with `stripe_session_id`, `payment_attempted_at`.
   - Returns `{ success, url, sessionId }`.

3. **Cart cleared before redirect** (known issue)
   - `clearCart()` runs **before** `window.location.href = paymentResult.url`.
   - If customer abandons Stripe Checkout, cart is empty but order exists as unpaid.
   - See [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md).

4. **Webhook** (`app/api/payment/stripe/webhook/route.ts`)
   - Verifies signature with `STRIPE_WEBHOOK_SECRET`.
   - On `checkout.session.completed` (non-subscription):
     - Reads `metadata.order_number`.
     - Skips if order already `payment_status === 'paid'` (**idempotency gate 1**).
     - Skips if `session.payment_status !== 'paid'`.
     - **Amount validation:** `session.amount_total === Math.round(order.total * 100)` — returns 400 on mismatch (**repair addition**).
     - Calls `fulfillOrderPayment(orderNumber, paymentRef)`.

5. **Fulfillment** (`lib/fulfill-order-payment.ts`)
   - RPC `mark_order_paid({ order_ref, moolre_ref: paymentRef })`.
   - Redeems coupon from order metadata if present.
   - Updates customer stats via `update_customer_stats` RPC.
   - Sends order confirmation email + SMS via `sendOrderConfirmation`.

6. **Client verify fallback** (`app/api/payment/stripe/verify/route.ts`)
   - Called from order-success page if `session_id` present and order still unpaid.
   - Rate-limited (`RATE_LIMITS.payment`).
   - Validates order number format (`ORD-\d+-\d+`).
   - Retrieves Stripe session; checks metadata match and `payment_status === 'paid'`.
   - **Amount validation:** same cents comparison as webhook (**repair addition**).
   - Calls same `fulfillOrderPayment` path.

7. **Order success page** (`app/(store)/order-success/page.tsx`)
   - Waits 2 seconds for webhook to process first.
   - Re-fetches order; if still unpaid, calls verify API.
   - Shows confetti when `payment_status === 'paid'`.

---

## Idempotency via `mark_order_paid`

### Webhook-level idempotency

```typescript
// app/api/payment/stripe/webhook/route.ts
if (order?.payment_status === 'paid') {
  return NextResponse.json({ received: true });
}
```

Duplicate webhook deliveries for already-paid orders are acknowledged without re-processing.

### Verify-level idempotency

```typescript
// app/api/payment/stripe/verify/route.ts
if (order.payment_status === 'paid') {
  return NextResponse.json({ success: true, message: 'Order already paid' });
}
```

### Database-level idempotency (`mark_order_paid` RPC)

Location: `supabase/migrations/20260209000000_complete_schema.sql`

| Behavior | Detail |
|----------|--------|
| Payment status update | Sets `payment_status = 'paid'`, promotes `pending`/`awaiting_payment` → `processing` |
| Metadata | Appends `moolre_reference` (Stripe ref), `payment_verified_at` |
| Stock reduction | Runs only if `metadata.stock_reduced` is null |
| After stock run | Sets `metadata.stock_reduced = true` |

**Note:** The RPC does not early-return if already paid — it re-UPDATEs the row. Stock reduction is protected by the `stock_reduced` flag. Webhook/verify gates prevent duplicate notification sends in normal operation.

### Payment reference storage

```typescript
const paymentRef =
  (typeof session.payment_intent === 'string' && session.payment_intent) ||
  session.id;
```

Stored in `orders.metadata.moolre_reference` (legacy key name) and visible in admin as fallback display alongside `stripe_session_id`.

---

## Stripe — Meal-Prep Subscription Flow

### Checkout creation

`app/api/subscriptions/create-checkout/route.ts` → Stripe Checkout `mode: 'subscription'` with `metadata.type = 'meal_prep'`, `user_id`, `plan_id`, `delivery_method`.

### Webhook handling

| Event | Handler |
|-------|---------|
| `checkout.session.completed` (subscription + meal_prep) | `fulfillSubscriptionCheckout()` — links Stripe customer to profile, upserts `meal_prep_subscriptions` |
| `customer.subscription.updated` | `syncSubscriptionFromStripe()` |
| `customer.subscription.deleted` | `syncSubscriptionFromStripe()` |
| `invoice.paid` (subscription_cycle / subscription_create) | `handleSubscriptionInvoicePaid()` — advances billing period |

Files: `lib/fulfill-subscription.ts`, `lib/stripe-meal-prep.ts`, `lib/stripe-subscription-helpers.ts`

### Customer portal

`POST /api/subscriptions/portal` → Stripe Billing Portal for self-service cancel/update payment method.

---

## Pay Page (Retry / Admin Link)

**Route:** `/pay/[orderId]` (UUID or order_number)

- Loads limited order info via `GET /api/orders/pay-info?ref=...` (no full PII).
- Redirects to order-success if already paid.
- "Pay Now" calls same `create-checkout-session` API.

Used as Stripe `cancel_url` and for admin "send payment link" flows.

---

## Cash on Delivery / Non-Stripe

When payment method is not Stripe:

1. Order inserted with pending/awaiting status.
2. Coupon redeemed immediately via `/api/coupons/redeem`.
3. `/api/notifications` triggered with `type: 'order_created'`.
4. Cart cleared; redirect to order-success.

Stock reduction for COD depends on order status workflow — Stripe path reduces stock in `mark_order_paid` only.

---

## POS Admin Payments

`app/admin/pos/page.tsx` creates orders in-admin and calls:

```typescript
await supabase.rpc('mark_order_paid', {
  order_ref: orderNumber,
  moolre_ref: `POS-${paymentMethod.toUpperCase()}-${Date.now()}`
});
```

POS uses in-person payment methods (cash, etransfer, etc.) — not Stripe Checkout. Reference prefix `POS-` distinguishes from Stripe refs.

---

## Moolre — SMS Only

**Not a payment gateway in this project.**

Implementation: `lib/notifications.ts` → `sendSMS()`

| Setting | Env var |
|---------|---------|
| API key | `MOOLRE_SMS_API_KEY` or `MOOLRE_API_KEY` |
| Sender ID | `SMS_SENDER_ID` or `MOOLRE_SMS_SENDER_ID` (default `MaameKitch`) |
| Endpoint | `POST https://api.moolre.com/open/sms/send` |
| Timeout | **15 seconds** (AbortController — repair addition) |

SMS is sent on order confirmation and payment reminders. Failure is logged; does not block payment fulfillment.

Admin test page: `/admin/test-sms`

---

## Webhook Configuration Checklist

| Item | Value |
|------|-------|
| URL | `https://maamekskitchen.ca/api/payment/stripe/webhook` |
| Secret env | `STRIPE_WEBHOOK_SECRET` |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` |
| API version | Managed by `stripe` npm package (^18.0.0) |

---

## Security Controls

| Control | Location | Status |
|---------|----------|--------|
| Webhook signature verification | webhook route | ✅ |
| Amount vs order.total (webhook) | webhook route | ✅ Added in repair |
| Amount vs order.total (verify) | verify route | ✅ Added in repair |
| Session metadata order_number match | verify route | ✅ |
| Rate limiting on verify/lookup/pay-info | `lib/rate-limit.ts` | ✅ In-memory |
| `mark_order_paid` staff-only via REST ACL | `rest-acl.ts` | ✅ Guests cannot call RPC |
| Service role for webhook fulfillment | `supabaseAdmin` in-process | ✅ Bypasses ACL |

---

## Explicit Non-Items

The following are **not implemented** and require no callback URLs, env vars, or webhook endpoints:

- Hubtel payment initiation or callback
- Paystack payment initiation or callback
- Moolre payment collection (only SMS API is used)

Do not add Hubtel/Paystack documentation or env vars to deployment configs for this store.

---

## Related Documents

- [FULL_SYSTEM_AUDIT.md](./FULL_SYSTEM_AUDIT.md)
- [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) — cart orphan issue
- [.env.example](./.env.example) — Stripe and Moolre SMS vars
