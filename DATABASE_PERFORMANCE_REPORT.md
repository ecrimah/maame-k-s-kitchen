# Database Performance Report

**Project:** Maame K's Kitchen  
**Report date:** 2026-08-02  
**Database:** PostgreSQL 16.14 on `fleet-postgres`  
**Workload profile:** Small restaurant e-commerce (~30 products, ~31 orders at audit); admin-heavy reads

---

## Executive Summary

Index coverage is **adequate for current data volume**. The hardening migration added payment-critical indexes. Primary performance risks are **application-level N+1 patterns** in admin dashboards and analytics, not missing DB indexes on core storefront paths.

At current scale, query latency is dominated by network round-trips (REST shim over HTTP for client admin) rather than sequential scans on Postgres.

---

## Connection Pool

**File:** `lib/db/pool.ts`

| Setting | Default | Notes |
|---------|---------|-------|
| `max` | 10 (`PG_POOL_MAX`) | Sufficient for single Next.js instance |
| `idleTimeoutMillis` | 30,000 | |
| SSL | Off unless `PGSSL=require` | VPS-local Postgres |

**Recommendation:** Increase `PG_POOL_MAX` to 15–20 if running multiple Coolify replicas behind load balancer.

---

## Existing Indexes (Base Schema)

From `20260209000000_complete_schema.sql` and subsequent migrations.

### Profiles & users

| Index | Table | Columns |
|-------|-------|---------|
| `idx_profiles_email` | profiles | email |
| `idx_profiles_role` | profiles | role |

### Catalog

| Index | Table | Columns |
|-------|-------|---------|
| `idx_categories_slug` | categories | slug |
| `idx_categories_parent` | categories | parent_id |
| `idx_products_slug` | products | slug |
| `idx_products_category` | products | category_id |
| `idx_products_status` | products | status |
| `idx_products_featured` | products | featured |
| `idx_products_tags` | products | tags (GIN) |
| `proteins_active_position_idx` | proteins | is_active, position |

### Orders

| Index | Table | Columns | Notes |
|-------|-------|---------|-------|
| `idx_orders_order_number` | orders | order_number | Lookup / tracking |
| `idx_orders_status` | orders | status | Admin filters |
| `idx_orders_user` | orders | user_id | Account history |
| `idx_orders_pending_reminders` | orders | created_at | Partial: pending payment |
| `idx_order_items_order` | order_items | order_id | Line items by order |

### CRM & support

| Index | Table | Columns |
|-------|-------|---------|
| `idx_customers_email` | customers | email |
| `idx_customers_user_id` | customers | user_id |
| `idx_reviews_product` | reviews | product_id |
| `idx_tickets_user` | support_tickets | user_id |

### Meal prep

| Index | Table | Columns |
|-------|-------|---------|
| `idx_meal_prep_subs_user` | meal_prep_subscriptions | user_id |
| `idx_meal_prep_subs_stripe` | meal_prep_subscriptions | stripe_subscription_id |
| `idx_meal_prep_one_active_sub_per_user` | meal_prep_subscriptions | user_id (partial unique) |
| `idx_meal_prep_selections_week` | meal_prep_selections | week_id |
| `idx_meal_prep_weeks_status` | meal_prep_weeks | status, week_start |

---

## New Indexes (Hardening Migration)

From `20260802000000_staging_db_hardening.sql`.

### Orders (payment queries)

| Index | Columns | Use case |
|-------|---------|----------|
| `idx_orders_payment_status` | payment_status | Admin paid/pending tabs |
| `idx_orders_payment_transaction_id` | payment_transaction_id (partial) | Stripe ref lookup |
| `idx_orders_created_at` | created_at DESC | Recent orders sort |

### Contact & newsletter

| Index | Table | Columns |
|-------|-------|---------|
| `idx_contact_submissions_created` | contact_submissions | created_at DESC |
| `idx_contact_submissions_email` | contact_submissions | lower(email) |
| `idx_newsletter_subscribers_status` | newsletter_subscribers | status |

### Payment events

| Index | Type | Columns |
|-------|------|---------|
| `uq_payment_events_external` | UNIQUE partial | gateway, external_event_id |
| `uq_payment_events_payload_hash` | UNIQUE partial | gateway, payload_hash |
| `idx_payment_events_order` | btree | order_number |
| `idx_payment_events_status` | btree | processing_status, received_at DESC |

### SMS messages

| Index | Type | Columns |
|-------|------|---------|
| `uq_sms_idempotency` | UNIQUE partial | idempotency_key |
| `idx_sms_order` | btree | related_order_number |
| `idx_sms_status` | btree | status, created_at DESC |

---

## Query Patterns by Surface

### Storefront (low risk)

| Page / API | Pattern | Index usage |
|------------|---------|-------------|
| Menu / categories | `products` + embed images, category | slug, status, category_id |
| Product detail | `products.eq('slug')` | idx_products_slug |
| Sitemap | Active products slugs | status + slug |
| Checkout insert | Single order + batch order_items | PK / FK indexes |

SSR paths use `supabaseAdmin` (in-process Pool) — **one hop**, no HTTP ACL overhead.

### Stripe webhook (low risk)

1. Insert `payment_events` — unique index hit on retry (cheap)
2. Select order by `order_number` — `idx_orders_order_number`
3. RPC `mark_order_paid` — PK lookup + order_items via `idx_order_items_order`

### Admin (moderate risk — N+1)

| Surface | Pattern | Issue |
|---------|---------|-------|
| **Orders list** | Single query with embed `order_items(quantity, product_name)` | ✅ Efficient |
| **Analytics** | Fetch paid orders, then **second query** for order_items by order id list with product/category embed | ⚠️ Two round trips; OK at small scale |
| **Analytics (commented alt)** | Initial attempt filtered order_items by `created_at` without order join | ⚠️ Would skew results — current code uses order id filter |
| **Product admin form** | Sequential deletes/inserts for variants/images | ⚠️ Multiple writes per save — acceptable for admin |
| **Order detail** | Order + items + history | Typically 1–2 queries |

---

## Remaining Admin N+1 Risks

These are **application patterns**, not missing indexes. Monitor if order count exceeds ~1,000.

### 1. Admin orders page — full table load

**File:** `app/admin/orders/page.tsx`

```typescript
.from('orders')
.select(`..., order_items (...)`)
.order('created_at', { ascending: false });
```

- Loads **all orders** into browser memory
- Client-side filtering/sorting/stats
- **Risk:** Memory + initial payload size grows O(n)
- **Mitigation:** Server-side pagination, status filter in SQL, limit default to 90 days

### 2. Analytics — order_items fan-out

**File:** `app/admin/analytics/page.tsx`

1. Query all paid orders in date range
2. Query order_items for `orderIds` with nested `products(categories(name))`

**Risk:** Second query row count = total line items in range. Embeds add join work.

**Mitigation:**

- Materialized view `daily_product_sales`
- Single SQL aggregate via RPC or admin API route
- Cap date range server-side

### 3. Product sales stats component

**File:** `app/admin/orders/ProductSalesStats.tsx` (if present)

Often aggregates client-side from already-loaded orders — duplicates work from main list.

### 4. REST shim HTTP overhead

Client admin uses `supabase-js` → HTTP → `/rest/v1` → Pool. Each admin page load incurs JSON serialization + HTTP latency vs server components with direct Pool.

**Mitigation:** Migrate hot admin reads to Server Components + `supabaseAdmin`.

### 5. Notification order fetch

**File:** `lib/notifications.ts`

Fetches order_items separately when sending email — 2 queries per notification (acceptable volume).

---

## Missing Indexes (Optional Future)

Not required at current scale; consider if metrics degrade.

| Suggested index | Reason |
|-----------------|--------|
| `orders (created_at DESC) WHERE payment_status = 'paid'` | Analytics revenue queries |
| `order_items (product_id)` | Product-level sales reports |
| `products (status, featured) WHERE status = 'active'` | Partial index for menu SSR |
| `kitchen_events (status, event_date)` | Events page published filter |

---

## RLS Policy Overhead

RLS remains **enabled** on many tables from Supabase dump. Impact:

| Access path | RLS evaluated? |
|-------------|----------------|
| HTTP REST shim (ACL only) | Policies not invoked by shim SQL |
| `supabaseAdmin` direct queries | Depends on role — typically `store_maameks` bypasses or uses SECURITY DEFINER RPCs |
| Manual psql as postgres | Policies apply if role is not owner |

**Recommendation:** After cutover stabilizes, migration to `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on public tables to reduce confusion and direct-psql overhead.

---

## Monitoring Queries

```sql
-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 15;

-- Index usage (run after production traffic)
SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC
LIMIT 20;

-- Sequential scans on hot tables
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('orders', 'order_items', 'products')
ORDER BY seq_scan DESC;

-- Slow queries (requires pg_stat_statements extension)
-- SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

---

## Performance Test Checklist (Post-Deploy)

| Test | Target |
|------|--------|
| Menu page TTFB | < 500ms with warm cache |
| Admin orders load (100 orders) | < 2s total |
| Stripe webhook processing | < 1s DB portion |
| Health check `SELECT 1` | < 50ms on VPS-local socket |

---

## Related Documents

- [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) — tables and FKs
- [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md) — audit context
- [PAYMENT_DATABASE_AUDIT.md](./PAYMENT_DATABASE_AUDIT.md) — payment indexes
