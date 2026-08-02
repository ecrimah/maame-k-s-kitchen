# Performance Report

**Project:** Maame K's Kitchen  
**Audit date:** 2026-08-02  
**Branch:** `staging/plain-postgres`

This report covers known performance and UX issues, fixes applied during the repair session, and recommended follow-ups. It reflects the **actual** architecture (Next.js 15, client-heavy admin, Stripe-only payments) — not a generic template.

---

## Executive Summary

The storefront is reasonably optimized for a restaurant ecommerce site (cached storefront APIs, image optimization, PWA). The **admin dashboard** is the primary performance concern: client-side data fetching with **unpaginated queries** loads entire tables into browser memory. A **checkout UX bug** clears the cart before Stripe redirect, orphaning carts on payment abandonment.

Server-side repairs (SSR via `supabaseAdmin`, REST ACL, dedicated lookup APIs) improve SEO reliability and reduce client over-fetching on critical paths.

---

## Known Issues (Open)

### 1. Client-heavy admin dashboard

**Severity:** Medium (grows with order volume)

**Description:** Nearly all admin pages are `'use client'` components that fetch data in `useEffect` via browser `supabase` client. No server components, no React Query/SWR caching layer, no pagination on list endpoints.

**Examples:**

| Page | Query pattern | Risk |
|------|---------------|------|
| `app/admin/orders/page.tsx` | `.from('orders').select(..., order_items(...)).order('created_at')` — **no `.limit()`** | Loads all orders + items into memory |
| `app/admin/page.tsx` | Full orders select for dashboard stats | Same |
| `app/admin/customer-insights/page.tsx` | `profiles` + `orders` full select | Grows with customer base |
| `app/admin/products/page.tsx` | All products with embeds | Manageable at 30 products; scales poorly |
| `app/admin/pos/page.tsx` | Products + customers (customers limited to 200) | POS acceptable for now |

**Impact:** Slow initial admin load, high memory use, large REST payloads through `/rest/v1` shim.

**Recommendation:**
- Add server-side pagination (`.range(from, to)`) with page controls.
- Move dashboard aggregates to API routes or Postgres views.
- Consider React Query with stale-while-revalidate for admin lists.

---

### 2. Cart cleared before Stripe redirect

**Severity:** Medium (UX / conversion)

**Description:** In `app/(store)/checkout/page.tsx`, when Stripe payment initializes successfully:

```typescript
saveAppliedCouponToSession(null);
clearCart();
window.location.href = paymentResult.url;
```

Cart is wiped **before** the customer completes payment on Stripe. If they cancel or close the Stripe tab, they return to an empty cart but an unpaid order exists.

**Impact:** Customer must re-add items or use `/pay/{order_number}` to retry payment.

**Recommendation:** Defer `clearCart()` until:
- Stripe redirect to order-success with verified payment, or
- Webhook confirms paid (with localStorage backup of cart until then).

**Status:** Not fixed in repair session (documented only).

---

### 3. TypeScript build errors ignored

**Severity:** Low–Medium (maintainability)

**Description:** `next.config.ts` sets `typescript.ignoreBuildErrors: true`.

**Impact:** Type errors ship to production builds undetected; refactors may introduce runtime bugs.

**Recommendation:** Incrementally fix errors; set `ignoreBuildErrors: false` before major releases.

---

### 4. In-memory rate limiting

**Severity:** Low (multi-instance deploys)

**Description:** `lib/rate-limit.ts` uses process-local memory for payment/lookup rate limits.

**Impact:** Limits reset on restart; not shared across multiple Next.js instances behind a load balancer.

**Recommendation:** Redis or edge rate limiting if scaling beyond single VPS instance.

---

### 5. Order-success client fetch

**Severity:** Low

**Description:** `app/(store)/order-success/page.tsx` still loads full order via client `supabase.from('orders').select('*, order_items(*)')` rather than a dedicated API.

**Impact:** Relies on REST ACL allowing guest order GET by order_number; fetches more data than needed.

**Recommendation:** Mirror `/api/orders/lookup` pattern with session_id verification for success page.

---

### 6. Guest orders readable via REST

**Severity:** Low–Medium (security/performance)

**Description:** REST ACL allows anonymous GET on `orders` table (filtered client-side by order_number). Enables order-success fetch but allows enumeration attempts.

**Mitigation applied:** Order tracking moved to `/api/orders/lookup` with email verification.

**Recommendation:** Tighten REST ACL to deny guest orders GET; route all guest order reads through authenticated APIs.

---

### 7. Large admin bundle (POS page)

**Severity:** Low

**Description:** `app/admin/pos/page.tsx` is ~978 lines, single client component with extensive inline logic.

**Impact:** Large JS chunk for admin POS route; slower first load on tablet POS devices.

**Recommendation:** Code-split subcomponents; lazy load rarely used POS features.

---

## Fixes Applied (Repair Session)

### SSR / SEO paths use server admin client

**Problem:** `sitemap.ts`, `menu/layout.tsx`, `product/[slug]/page.tsx`, `categories/page.tsx` used browser `supabase` client. In plain-Postgres mode (no hosted Supabase), these returned empty data at build/request time.

**Fix:** Switched to `supabaseAdmin` (in-process pg compat) for server-side data fetching.

**Benefit:** Reliable sitemap generation, menu JSON-LD, product meta tags, category listings without HTTP round-trip to self.

---

### Dedicated APIs reduce client over-fetch

| API | Benefit |
|-----|---------|
| `POST /api/orders/lookup` | Server-side email verification; single optimized query with embeds |
| `GET /api/orders/pay-info` | Returns 7 fields instead of full order row + PII |

**Benefit:** Smaller payloads, better security, rate-limited endpoints.

---

### SMS 15-second timeout

**Problem:** Moolre SMS fetch had no timeout — hung connections could block notification pipeline.

**Fix:** `AbortController` with 15_000ms timeout in `lib/notifications.ts` `sendSMS()`.

**Benefit:** Payment fulfillment (`fulfillOrderPayment`) no longer waits indefinitely on SMS; email still sends.

---

### Storefront API caching headers

**Existing (unchanged):** `next.config.ts` sets aggressive CDN cache on `/api/storefront/*`:

```
Cache-Control: public, s-maxage=900, stale-while-revalidate=1800
```

**Benefit:** 15-minute CDN cache for product/category feeds; reduces DB load for menu browsing.

---

### Image optimization

**Existing (unchanged):**

- Next.js Image with AVIF/WebP formats
- 30-day `minimumCacheTTL` for optimized images
- Remote patterns for VPS storage and legacy Supabase URLs during migration

---

### Connection pool tuning

**Existing:** `lib/db/pool.ts`

| Setting | Value |
|---------|-------|
| `PG_POOL_MAX` | Default 10 (env override) |
| `idleTimeoutMillis` | 30,000 |

**Benefit:** Prevents connection exhaustion under moderate concurrent load on single VPS Postgres.

---

### Health endpoint for deploy probes

**New:** `GET /api/health` — lightweight DB ping (`SELECT 1`) when plain Postgres configured.

**Benefit:** Coolify/load balancer can detect degraded DB without hitting storefront pages.

---

## Performance Baseline Estimates

At current data scale (30 products, 30 orders, 1 admin user):

| Path | Expected behavior |
|------|-------------------|
| `/menu` | Fast — client fetch + optional SSR metadata |
| `/api/storefront/products` | Cacheable; 15 min CDN |
| Admin orders list | Acceptable — ~30 orders |
| Admin at 1000+ orders | **Will degrade** without pagination |
| Stripe checkout | Dominated by Stripe redirect latency |
| Webhook fulfillment | Single RPC + async email/SMS |

---

## Monitoring Recommendations

1. **`GET /api/health`** — alert on `503` or `db: "error"`.
2. **Stripe Dashboard** — monitor webhook failure rate after VPS cutover.
3. **Postgres** — watch connection count and slow queries on `store_maameks`.
4. **Coolify logs** — watch for `[SMS] Error` timeout messages vs success.
5. **Core Web Vitals** — menu and product pages (LCP driven by hero/product images).

---

## Priority Backlog

| Priority | Item | Effort |
|----------|------|--------|
| P1 | Admin orders pagination | Medium |
| P1 | Defer cart clear until payment success | Small |
| P2 | Remove `ignoreBuildErrors` | Medium |
| P2 | Order-success server API | Small |
| P3 | Tighten REST ACL on guest orders GET | Medium |
| P3 | Redis rate limiting | Medium |
| P4 | Admin dashboard server components | Large |

---

## Related Documents

- [FULL_SYSTEM_AUDIT.md](./FULL_SYSTEM_AUDIT.md)
- [PAYMENT_AND_CALLBACK_AUDIT.md](./PAYMENT_AND_CALLBACK_AUDIT.md) — cart orphan context
- [REPAIR_CHANGELOG.md](./REPAIR_CHANGELOG.md)
