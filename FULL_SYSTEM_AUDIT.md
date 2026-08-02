# Maame K's Kitchen — Full System Audit

**Project:** Maame K's Kitchen — Ghanaian restaurant ecommerce (Calgary, Alberta, Canada)  
**Repository branch:** `staging/plain-postgres`  
**Audit date:** 2026-08-02  
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Plain Postgres (VPS) with supabase-js compat shims

---

## Executive Summary

Maame K's Kitchen is a full-featured restaurant ordering site with admin dashboard, Stripe Checkout for one-time orders, Stripe Billing for meal-prep subscriptions, email (Resend), and SMS (Moolre — SMS only, not payments). The codebase is migrating from hosted Supabase to plain Postgres on the fleet VPS (`store_maameks`), using an in-process compatibility layer so existing `@supabase/supabase-js` client code continues to work against `/auth/v1`, `/rest/v1`, and `/storage/v1` shims on the app origin.

This audit documents the **baseline state before repairs**, the **current architecture**, route inventory, findings, fixes applied in the repair session, and **remaining risks** before production cutover on the VPS.

---

## BASELINE — Before Repairs (2026-08-02)

These issues existed on `staging/plain-postgres` immediately after the initial plain-Postgres compat layer landed (`f7fdcc7`), before the repair pass documented here.

| Area | Baseline condition | Severity |
|------|-------------------|----------|
| **REST `/rest/v1`** | Wide open — any caller with the anon key could read/write most tables with no application-level ACL | Critical |
| **Order tracking** | Client-side email check against openly readable `orders` rows via supabase-js | High |
| **Pay page** | Loaded full order rows (including PII) directly from client supabase-js | High |
| **SSR / SEO paths** | `sitemap.ts`, `menu/layout.tsx`, `product/[slug]/page.tsx`, `categories/page.tsx` used browser `supabase` client — failed or returned empty data when `DATABASE_URL` set without hosted Supabase | High |
| **Middleware admin auth** | Plain-PG detection relied on `NEXT_PUBLIC_USE_PLAIN_PG` only; `DATABASE_URL`-only deploys could skip JWT admin verification | High |
| **Stripe webhook** | No amount validation — tampered or mismatched Checkout sessions could mark orders paid | High |
| **Stripe verify API** | No amount validation on client-initiated verify fallback | Medium |
| **SMS (Moolre)** | No fetch timeout — hung requests could block notification pipeline | Medium |
| **Password recovery** | `/auth/v1/recover` returned silent success or was unimplemented — misleading UX in plain-PG mode | Medium |
| **Health monitoring** | No `/api/health` endpoint for deploy smoke tests | Low |
| **VPS deploy** | DB `store_maameks` provisioned from dump; **Coolify app not created** | Blocking |
| **Storage** | Supabase Storage URLs still in image config; local disk storage shim exists but **files not migrated** to VPS | Blocking |
| **TypeScript** | `typescript.ignoreBuildErrors: true` in `next.config.ts` | Debt |
| **Hubtel / Paystack** | **Not present in codebase** (correct — this store uses Stripe only) | N/A |

### Baseline data snapshot (VPS `store_maameks`)

Restored from `maame_staging_2026-08-02.dump`:

| Entity | Count |
|--------|-------|
| Products | 30 |
| Categories | 12 |
| Orders | 30 |
| Auth users | 1 |

---

## Architecture

### High-level diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (storefront + admin)                     │
│   @supabase/supabase-js → NEXT_PUBLIC_SUPABASE_URL = app origin         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  /auth/v1/*              /rest/v1/*              /storage/v1/*
  (GoTrue shim)           (PostgREST shim)       (local disk shim)
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    lib/db/supabase-compat.ts
                    lib/db/auth.ts · lib/db/storage.ts
                                │
                                ▼
                    lib/db/pool.ts  →  pg Pool  →  DATABASE_URL
                                │
                                ▼
                         store_maameks (Postgres)
```

### Dual-mode database access

| Context | Client | When |
|---------|--------|------|
| Browser / client components | `lib/supabase.ts` → `@supabase/supabase-js` pointed at app origin | Always |
| API routes, SSR, webhooks | `lib/supabase-admin.ts` → compat layer when `DATABASE_URL` set; else hosted Supabase service role | Server only |
| Middleware (admin gate) | JWT verify via `jose` when plain-PG; else Supabase `getUser` + profiles role check | `/admin/*` |

Plain-Postgres mode is detected by `lib/db/mode.ts`:

```ts
isPlainPostgres() → !!(DATABASE_URL || POSTGRES_URL)
```

### Payments architecture

| Gateway | Status | Usage |
|---------|--------|-------|
| **Stripe Checkout** | Implemented | One-time food orders (CAD) |
| **Stripe Billing** | Implemented | Meal-prep weekly subscriptions |
| **Hubtel** | **Not implemented** | N/A |
| **Paystack** | **Not implemented** | N/A |
| **Moolre** | SMS only | Order/payment notifications via `https://api.moolre.com/open/sms/send` |

Legacy Postgres RPC parameter `moolre_ref` in `mark_order_paid(order_ref, moolre_ref)` stores **Stripe payment intent / session IDs** — the name is historical, not a Moolre payment integration.

### Auth architecture (plain-PG)

- Passwords hashed with bcrypt in `auth.users`-compatible table (`lib/db/auth.ts`)
- JWT access/refresh tokens signed with `AUTH_JWT_SECRET` (required in production)
- Admin/staff role stored in JWT `app_metadata.role` and enforced by middleware
- Password recovery email: **returns HTTP 501** — not wired for plain-PG

### Storage architecture (plain-PG)

- Files served from `STORAGE_ROOT` on disk (default `/data/maameks/storage`)
- Public URLs: `{STORAGE_PUBLIC_URL}/storage/v1/object/public/{bucket}/{path}`
- Uploads restricted to admin/staff via REST ACL + storage write gate

---

## Route Inventory

### Pages — 61 total

| Section | Count | Examples |
|---------|-------|----------|
| Storefront `(store)/` | 37 | `/`, `/menu`, `/checkout`, `/meal-prep`, `/order-tracking`, `/pay/[orderId]` |
| Admin `/admin/` | 24 | `/admin`, `/admin/orders`, `/admin/pos`, `/admin/subscriptions`, `/admin/products` |

Additional non-page routes: `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `not-found.tsx`, `twitter-image.tsx`.

### API routes — 18

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Deploy smoke test (DB ping, env presence) |
| `/api/orders/lookup` | POST | Guest order tracking (order_number + email) |
| `/api/orders/pay-info` | GET | Limited order fields for `/pay/[orderId]` |
| `/api/payment/stripe/create-checkout-session` | POST | Create Stripe Checkout for order |
| `/api/payment/stripe/verify` | POST | Client fallback payment verification |
| `/api/payment/stripe/webhook` | POST | Stripe webhook (orders + subscriptions) |
| `/api/subscriptions/create-checkout` | POST | Meal-prep subscription Checkout |
| `/api/subscriptions/cancel` | POST | Cancel subscription |
| `/api/subscriptions/portal` | POST | Stripe Customer Portal |
| `/api/subscriptions/select-meals` | POST | Weekly meal selection |
| `/api/subscriptions/sync-plan` | POST | Sync plan from Stripe |
| `/api/storefront/products` | GET | Cached product feed |
| `/api/storefront/categories` | GET | Cached category feed |
| `/api/coupons/redeem` | POST | Coupon usage increment |
| `/api/notifications` | POST | Trigger order/admin notifications |
| `/api/newsletter` | POST | Newsletter signup |
| `/api/recaptcha/verify` | POST | reCAPTCHA validation |
| `/api/cron/payment-reminders` | GET | Unpaid order reminder cron |

### Supabase-compat proxy routes — 6

| Route | Purpose |
|-------|---------|
| `/auth/v1/[...path]` | GoTrue-compatible auth (login, signup, token, user) |
| `/rest/v1/[table]` | PostgREST-compatible table CRUD with ACL |
| `/rest/v1/rpc/[fn]` | RPC dispatch with ACL |
| `/storage/v1/object/[bucket]/[...path]` | Upload/delete objects |
| `/storage/v1/object/public/[bucket]/[...path]` | Public file serve |
| `/storage/v1/object/sign/[bucket]/[...path]` | Signed URL generation |

**Total route handlers:** 61 pages + 18 API + 6 proxies = **85** (plus metadata routes).

---

## Security Findings & Fixes

### Fixed in repair session

| Finding | Fix | Files |
|---------|-----|-------|
| REST wide open | Application-level ACL: `lib/db/rest-acl.ts` + `lib/db/rest-auth.ts`; enforced in `/rest/v1` routes | `rest-acl.ts`, `rest-auth.ts`, `app/rest/v1/**` |
| Insecure order tracking | Server-side `/api/orders/lookup` requires order_number + email match | `app/api/orders/lookup/route.ts`, `order-tracking/page.tsx` |
| Pay page PII exposure | `/api/orders/pay-info` returns id, order_number, status, payment_status, total, currency only | `app/api/orders/pay-info/route.ts`, `pay/[orderId]/page.tsx` |
| SSR broken in plain-PG | Switched to `supabaseAdmin` on sitemap, menu layout, product meta, categories | `sitemap.ts`, `menu/layout.tsx`, `product/[slug]/page.tsx`, `categories/page.tsx` |
| Middleware PG detection gap | Also checks `DATABASE_URL \|\| POSTGRES_URL` | `middleware.ts` |
| Webhook amount tampering | Compare `session.amount_total` vs `order.total * 100` | `app/api/payment/stripe/webhook/route.ts` |
| Verify API amount gap | Same amount check in verify route | `app/api/payment/stripe/verify/route.ts` |
| SMS hang risk | 15-second AbortController timeout on Moolre fetch | `lib/notifications.ts` |
| Password recovery lie | `/auth/v1/recover` returns 501 with clear message; UI handles it | `app/auth/v1/[...path]/route.ts`, `forgot-password/page.tsx` |
| No health endpoint | `/api/health` with DB ping and env checks | `app/api/health/route.ts` |

### REST ACL summary (post-fix)

- **Public read:** catalog/CMS tables (products, categories, coupons, meal_prep_weeks, etc.)
- **Public insert:** orders, order_items, contact_submissions, newsletter_subscribers, reviews
- **User-scoped GET:** profiles, meal_prep_subscriptions, support_tickets, addresses, cart_items, notifications, return_requests
- **Staff/service_role:** full access; staff-only RPCs (`mark_order_paid`, `reduce_stock_on_order`, etc.)
- **Guest orders GET:** still allowed (needed for order-success client fetch); tracking tightened via dedicated API

### Remaining security considerations

1. **Guest `orders` GET via REST** — anon clients can still query orders by `order_number` filter. Mitigated for tracking via `/api/orders/lookup`, but order-success page still reads orders client-side.
2. **AUTH_JWT_SECRET** — must be set before production; dev fallback exists in code.
3. **Rate limiting** — in-memory only (`lib/rate-limit.ts`); resets on process restart; not shared across replicas.
4. **CORS on shims** — `/auth/v1` and `/rest/v1` allow `*` origin (matches Supabase SDK expectations).

---

## Payment Flow Integrity

See [PAYMENT_AND_CALLBACK_AUDIT.md](./PAYMENT_AND_CALLBACK_AUDIT.md) for full Stripe flow documentation.

Summary:

1. Checkout creates order → Stripe Checkout session → redirect
2. Webhook `checkout.session.completed` → amount check → `fulfillOrderPayment` → `mark_order_paid` RPC
3. Fallback: order-success page calls `/api/payment/stripe/verify` after 2s delay
4. Idempotency: webhook skips if `payment_status === 'paid'`; `mark_order_paid` uses `stock_reduced` flag to prevent double stock deduction

---

## Performance Notes

See [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md).

Key issues still open:

- Admin dashboard is client-heavy with unpaginated queries (e.g. all orders loaded at once)
- Cart cleared before Stripe redirect — abandoned payment orphans the cart
- `typescript.ignoreBuildErrors: true` masks type errors at build time

Fixes applied: storefront API caching headers, SMS timeout, SSR moved to server admin client.

---

## Remaining Risks & Manual Actions

| Item | Status | Action required |
|------|--------|-----------------|
| Coolify app | **Not created** | Owner creates app in Coolify UI, connects repo `staging/plain-postgres` |
| Environment variables | Template only | Wire all vars from `.env.example` in Coolify (no secrets in git) |
| `AUTH_JWT_SECRET` | Must generate | Long random secret; required for admin JWT and REST auth |
| Stripe webhook URL | Not configured on VPS | Point to `https://maamekskitchen.ca/api/payment/stripe/webhook` |
| Storage migration | Pending | Copy Supabase Storage objects to `STORAGE_ROOT`; update any hardcoded URLs |
| Password recovery | 501 in plain-PG | Wire Resend recovery email in `/auth/v1/recover` or disable UI link |
| DNS / TLS | Unknown | Point `maamekskitchen.ca` to VPS once app is live |
| TypeScript debt | Open | Remove `ignoreBuildErrors` after fixing accumulated type errors |
| Build verification | Pending | Run `npm run build` with production env on VPS before go-live |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) | Cutover playbook |
| [SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md](./SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md) | Migration status matrix |
| [PAYMENT_AND_CALLBACK_AUDIT.md](./PAYMENT_AND_CALLBACK_AUDIT.md) | Stripe-only payment audit |
| [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) | Performance findings |
| [REPAIR_CHANGELOG.md](./REPAIR_CHANGELOG.md) | Files changed in repair session |

---

## Verification Checklist (post-deploy)

- [ ] `GET /api/health` → `{ status: "ok", db: "ok" }`
- [ ] Storefront menu loads products from plain Postgres
- [ ] Admin login works with JWT middleware path
- [ ] Test Stripe Checkout (test mode) → webhook → order marked paid
- [ ] Order tracking with wrong email returns 403
- [ ] Meal-prep subscription Checkout → webhook activates subscription
- [ ] SMS sends within 15s or times out gracefully
- [ ] Product images load from `/storage/v1/object/public/...`
- [ ] Sitemap includes product URLs
