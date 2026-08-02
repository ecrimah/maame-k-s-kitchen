# Repair Changelog

**Project:** Maame K's Kitchen  
**Session:** Plain-Postgres security & reliability repair pass  
**Date:** 2026-08-02  
**Base commit:** `f7fdcc7` — feat: plain Postgres compat layer for big-vps migration  
**Branch:** `staging/plain-postgres`

This changelog lists files created or modified during the repair session that addressed baseline issues documented in [FULL_SYSTEM_AUDIT.md](./FULL_SYSTEM_AUDIT.md).

---

## Summary of Changes

| Category | Change |
|----------|--------|
| Security | REST ACL + actor resolution for `/rest/v1` and `/storage/v1` |
| Security | Server-side order lookup with email verification |
| Security | Limited pay-info API (no full PII) |
| Security | Stripe webhook + verify amount validation |
| Reliability | SSR paths use `supabaseAdmin` instead of browser client |
| Reliability | Middleware plain-PG detection aligned with `DATABASE_URL` |
| Reliability | SMS 15s timeout; health endpoint |
| UX | Password recovery returns 501 with clear UI message |
| Config | `.env.example` updated for Maame K's VPS cutover |

---

## New Files

| File | Purpose |
|------|---------|
| `lib/db/rest-acl.ts` | Application-level ACL for REST table/RPC/storage access |
| `lib/db/rest-auth.ts` | Resolve caller identity (anon, authenticated, staff, service_role) from JWT/keys |
| `app/api/health/route.ts` | Deploy smoke test — DB ping, env presence checks |
| `app/api/orders/lookup/route.ts` | Guest order tracking with order_number + email server match |
| `app/api/orders/pay-info/route.ts` | Limited order fields for `/pay/[orderId]` page |
| `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` | Project-specific migration playbook |
| `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` | Migration status matrix |
| `FULL_SYSTEM_AUDIT.md` | Full system audit document |
| `PAYMENT_AND_CALLBACK_AUDIT.md` | Stripe-only payment flow audit |
| `PERFORMANCE_REPORT.md` | Performance findings and fixes |
| `REPAIR_CHANGELOG.md` | This file |

---

## Modified Files

### Configuration & environment

| File | Changes |
|------|---------|
| `.env.example` | Maame K's Kitchen env template: `DATABASE_URL`, `AUTH_JWT_SECRET`, storage vars, Stripe, Moolre SMS-only notes; explicit Hubtel/Paystack N/A |
| `next.config.ts` | Added `maamekskitchen.ca` and `sslip.io` to image `remotePatterns` for VPS storage URLs |
| `lib/db/mode.ts` | `authJwtSecret()` helper; production throws if secret missing |

### Database / compat layer

| File | Changes |
|------|---------|
| `app/rest/v1/[table]/route.ts` | Integrated `resolveRestActor` + `authorizeRestTable` ACL gate before queries |
| `app/rest/v1/rpc/[fn]/route.ts` | Integrated `authorizeRpc` ACL gate |
| `app/storage/v1/object/[bucket]/[...path]/route.ts` | Storage write authorization via ACL |

### Auth & middleware

| File | Changes |
|------|---------|
| `middleware.ts` | Plain-PG detection: `DATABASE_URL \|\| POSTGRES_URL` in addition to `NEXT_PUBLIC_USE_PLAIN_PG`; JWT admin verification path |
| `app/auth/v1/[...path]/route.ts` | `POST /recover` returns 501 with clear error (password recovery not wired) |
| `app/(store)/auth/forgot-password/page.tsx` | Handles 501 / not-implemented response with user-visible message |
| `lib/supabase.ts` | Lazy client init; build-safe stub when env missing; plain-PG comments |

### SSR / SEO (supabaseAdmin migration)

| File | Changes |
|------|---------|
| `app/sitemap.ts` | Uses `supabaseAdmin` for product/category URLs |
| `app/(store)/menu/layout.tsx` | Uses `supabaseAdmin` for menu JSON-LD structured data |
| `app/(store)/product/[slug]/page.tsx` | Uses `supabaseAdmin` for product metadata / OG |
| `app/(store)/categories/page.tsx` | Uses `supabaseAdmin` for category data |

### Storefront pages (security APIs)

| File | Changes |
|------|---------|
| `app/(store)/order-tracking/page.tsx` | Fetches via `POST /api/orders/lookup` instead of client-side email check |
| `app/(store)/pay/[orderId]/page.tsx` | Fetches via `GET /api/orders/pay-info` instead of full order REST query |
| `app/(store)/order-success/page.tsx` | Minor adjustments for payment verify flow compatibility |

### Payments

| File | Changes |
|------|---------|
| `app/api/payment/stripe/webhook/route.ts` | Amount validation: `session.amount_total` vs `order.total * 100`; reject mismatch with 400 |
| `app/api/payment/stripe/verify/route.ts` | *(verify route existed; amount check confirmed in repair)* |

### Notifications

| File | Changes |
|------|---------|
| `lib/notifications.ts` | 15-second AbortController timeout on Moolre SMS fetch |

---

## Files Unchanged (Clarifications)

These files were part of the initial migration commit and were **not** modified in the repair session but are relevant context:

| File | Role |
|------|------|
| `lib/db/supabase-compat.ts` | PostgREST-compatible query builder over pg |
| `lib/db/auth.ts` | bcrypt + JWT auth implementation |
| `lib/db/pool.ts` | pg connection pool |
| `lib/db/storage.ts` | Local disk storage client |
| `lib/supabase-admin.ts` | Server admin client selector (compat vs hosted) |
| `lib/fulfill-order-payment.ts` | Calls `mark_order_paid` with Stripe ref in `moolre_ref` param |
| `app/api/payment/stripe/create-checkout-session/route.ts` | Stripe Checkout session creation |
| `middleware.ts` (base) | Admin route protection |

---

## Issues Identified But Not Fixed

| Issue | File(s) | Notes |
|-------|---------|-------|
| Cart cleared before Stripe redirect | `app/(store)/checkout/page.tsx` | Documented in PERFORMANCE_REPORT.md |
| Admin unpaginated queries | `app/admin/orders/page.tsx`, others | Documented in PERFORMANCE_REPORT.md |
| `typescript.ignoreBuildErrors: true` | `next.config.ts` | Known debt |
| Password recovery email | `app/auth/v1/[...path]/route.ts` | Returns 501; needs Resend implementation |
| Coolify app creation | N/A | Manual owner action |
| Storage file migration | N/A | Manual copy to `STORAGE_ROOT` |
| Guest orders GET via REST | `lib/db/rest-acl.ts` | Still allowed for order-success client fetch |

---

## Verification Performed

- [x] Code review of all changed files
- [x] Route inventory counted (61 pages, 18 API, 6 proxy routes)
- [x] Confirmed Hubtel/Paystack absent from codebase
- [x] Confirmed Moolre used for SMS only
- [x] Confirmed `mark_order_paid` / `moolre_ref` legacy naming documented
- [ ] Production build with `DATABASE_URL` (pending VPS deploy)
- [ ] End-to-end Stripe test on VPS (pending Coolify app)

---

## Related Documents

- [FULL_SYSTEM_AUDIT.md](./FULL_SYSTEM_AUDIT.md)
- [docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md)
- [SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md](./SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md)
- [PAYMENT_AND_CALLBACK_AUDIT.md](./PAYMENT_AND_CALLBACK_AUDIT.md)
- [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md)
