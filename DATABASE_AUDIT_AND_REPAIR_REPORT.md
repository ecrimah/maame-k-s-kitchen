# Database Audit and Repair Report

**Project:** Maame K's Kitchen (`maame-ks-kitchen`)  
**Report date:** 2026-08-02  
**Auditor context:** Post–Supabase cutover hardening on fleet VPS  
**Branch:** `staging/plain-postgres`

---

## Executive Summary

Maame K's Kitchen migrated from hosted Supabase to plain PostgreSQL on the big VPS (`fleet-postgres`, PostgreSQL **16.14**). Two databases were refreshed from a live Supabase dump, integrity-scanned, and hardened with migration `20260802000000_staging_db_hardening.sql`:

| Database | Role | Hardening applied |
|----------|------|-------------------|
| `store_maameks` | Production target DB | Yes |
| `maame_staging` | Staging / pre-deploy mirror | Yes |

**Data integrity:** All automated checks passed (0 orphans, 0 duplicate business keys, profiles aligned with auth).  
**Payments:** Stripe only — Hubtel and Paystack are **not used** by this store.  
**Deploy gap:** Coolify app for this store is **not yet created**; DB staging exists but there is no website staging URL.

---

## Baseline Environment

| Item | Value |
|------|-------|
| PostgreSQL version | 16.14 |
| Container / service | `fleet-postgres` (Docker on big VPS) |
| Host access | VPS-local only — **not** a public Postgres endpoint |
| Connection (app) | `DATABASE_URL=postgresql://store_maameks:CHANGE_ME@127.0.0.1:5432/store_maameks` |
| Connection (superuser ops) | Via `docker exec fleet-postgres psql -U postgres` |
| Stack | Next.js 15 + `pg` Pool + in-process supabase-compat shim |
| ORM | None (no Prisma / Drizzle) |

### Source of truth for schema

1. **Live Supabase dump** → restored to both DBs (`maame_live_*.fixed.sql` under `/data/fleet/backups/`)
2. **Repo migrations** in `supabase/migrations/` (7 files, chronological)
3. **Hardening migration** applied on VPS via `scripts/apply-staging-hardening.sh`

Approximate inventory after restore:

| Entity | Count (at audit) |
|--------|------------------|
| Public tables | ~40 (+ 4 created by hardening) |
| Auth schema | Full Supabase `auth.*` from dump |
| Products | 30 |
| Categories | 12 |
| Orders | 31 total (4 paid, 27 pending) |
| Auth users | 1 (+ profiles row aligned) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 15 (Maame K's Kitchen)                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Client SDK  │  │ Server admin │  │ API routes          │ │
│  │ supabase-js │  │ supabaseAdmin│  │ Stripe webhook, etc │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
│         │ HTTP shims      │ in-process           │           │
│         ▼                 ▼                      ▼           │
│  /auth/v1  /rest/v1  /storage/v1          lib/db/pool.ts   │
│         REST ACL (lib/db/rest-acl.ts)                        │
└────────────────────────────┬────────────────────────────────┘
                             │ DATABASE_URL (127.0.0.1)
                             ▼
              ┌──────────────────────────────┐
              │  fleet-postgres (PG 16.14)   │
              │  store_maameks | maame_staging│
              └──────────────────────────────┘
```

### Security model (post-cutover)

| Layer | Supabase era | Plain Postgres era |
|-------|--------------|-------------------|
| HTTP table access | Postgres RLS + PostgREST | Application REST ACL (`lib/db/rest-acl.ts`) |
| Server jobs / webhooks | Service role key | `supabaseAdmin` → direct Pool (bypasses ACL) |
| Auth | Supabase GoTrue | `/auth/v1` shim + bcrypt + JWT (`lib/db/auth.ts`) |
| RLS policies on tables | Enforced by PostgREST | **Still present in DB** from dump; **not relied on** by HTTP shim |

The app intentionally uses server-side ACL and API-route checks instead of Postgres RLS for the REST shim. RLS remains as legacy baggage from the Supabase dump and could be cleaned up in a future migration once cutover is stable.

---

## Audit Methodology

### 1. Restore verification

- Confirmed both `store_maameks` and `maame_staging` accept connections
- Verified `auth.users`, `public.profiles`, core commerce tables present
- Compared table counts against dump metadata

### 2. Referential integrity scan

| Check | Result |
|-------|--------|
| `order_items` without valid `order_id` | **0 orphans** |
| `product_images` without valid `product_id` | **0 orphans** |
| `order_items.product_id` → missing product (where NOT NULL) | **0 orphans** |
| `products.category_id` → missing category | **0 orphans** |
| Duplicate `orders.order_number` | **0** |
| Duplicate `products.slug` | **0** |
| Duplicate `categories.slug` | **0** |
| `profiles.id` without matching `auth.users.id` | **0 misaligned** |
| `auth.users` without `profiles` row | **0** (trigger `handle_new_user` present) |
| Orders with negative `total` / `subtotal` | **0** |

### 3. Payment state audit

| Metric | Value |
|--------|-------|
| Paid orders (`payment_status = 'paid'`) | 4 |
| Pending payment | 27 |
| Negative totals | 0 |
| Paid orders missing `payment_transaction_id` | Review individually (legacy; new flow sets via `mark_order_paid`) |

### 4. Schema drift vs application code

The app references tables that were **missing** from the Supabase dump:

| Table | Used by | Drift status |
|-------|---------|--------------|
| `contact_submissions` | Contact page, REST ACL public insert | **Created** by hardening migration |
| `newsletter_subscribers` | Newsletter section | **Created** by hardening migration |
| `payment_events` | Stripe webhook idempotency | **Created** by hardening migration |
| `sms_messages` | Health check; future SMS audit trail | **Created** by hardening migration (app not yet writing rows) |

### 5. RPC / function audit

| Function | Purpose | Status |
|----------|---------|--------|
| `mark_order_paid(order_ref, moolre_ref)` | Idempotent paid transition + stock reduction | **Replaced** with idempotent version |
| `upsert_customer_from_order` | CRM upsert on checkout | Present from dump |
| `update_customer_stats` | Post-payment CRM stats | Present |
| `reduce_stock_on_order` | Manual stock RPC | Present |
| `get_all_customer_emails` / `get_all_customer_phones` | Admin marketing exports | Present |
| `is_admin_or_staff()` | RLS helper (legacy) | Present |
| `handle_new_user()` | Profile creation trigger | Present |

**Note:** Parameter `moolre_ref` is a **legacy name** — it stores Stripe payment intent / session references, not Moolre payment data. Moolre is SMS-only for this store.

---

## Repairs Applied

### Migration `20260802000000_staging_db_hardening.sql`

Applied to **both** `store_maameks` and `maame_staging` using `scripts/apply-staging-hardening.sh`:

1. **Created** `contact_submissions`, `newsletter_subscribers`, `payment_events`, `sms_messages`
2. **Added** payment lookup indexes on `orders` (`payment_status`, `payment_transaction_id`, `created_at`)
3. **Replaced** `mark_order_paid` with idempotent implementation (early return if already paid; sets `payment_transaction_id`)
4. **Seeded** `store_modules` with 10 enabled modules (admin sidebar)
5. **Granted** privileges to role `store_maameks` post-apply

### Application-layer repairs (codebase, pre-audit)

Documented in `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` and `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`:

- REST ACL replacing RLS for HTTP access
- Stripe webhook amount validation
- Order lookup / pay-info API hardening
- Health endpoint with required-table checks
- Password recovery 501 surfaced to users (gap documented)

---

## Drift Findings (Unresolved / Informational)

| Finding | Severity | Notes |
|---------|----------|-------|
| RLS policies still enabled on many tables | Low | Bypassed by design for HTTP shim; confusing for direct SQL access |
| `sms_messages` table empty | Info | Schema ready; SMS sends via Moolre API without DB logging yet |
| Storage files not on VPS | High (deploy) | Product `image_url` may still point at `*.supabase.co` |
| Coolify app not created | High (deploy) | No staging website URL despite `maame_staging` DB |
| Auth password recovery 501 | Medium | `/auth/v1/recover` not implemented in plain-PG shim |
| Legacy RPC arg name `moolre_ref` | Low | Cosmetic; stores Stripe refs |
| TypeScript `ignoreBuildErrors: true` | Low | Build debt unrelated to DB |
| `order_items` direct GET blocked by ACL | By design | Admin uses embed via orders; analytics fetches separately |

---

## Remaining Risks

### Operational

1. **No automated backup schedule verified in this audit** — rely on fleet backup scripts in `/data/fleet/backups/` (see `DATABASE_RECOVERY_GUIDE.md`).
2. **Single VPS Postgres** — no read replica; plan maintenance windows.
3. **Secrets in Coolify** — `AUTH_JWT_SECRET`, `STRIPE_WEBHOOK_SECRET`, DB password must be set before deploy.

### Security

1. **Guest order read via REST** — `orders` table allows anonymous GET (order number is unguessable; email verification on tracking is API-layer).
2. **RLS not removed** — direct DB access with user JWT could behave differently than app; app uses service role for admin.
3. **Webhook replay** — mitigated by `payment_events` unique indexes on `external_event_id` and `payload_hash`.

### Data

1. **27 pending orders** — may include abandoned checkouts; cron payment reminders depend on `CRON_SECRET` and `/api/cron/payment-reminders`.
2. **Stock reduction** — idempotent via `metadata.stock_reduced`; duplicate webhook delivery safe after hardening.

---

## Verification Commands

Run on VPS (placeholders only):

```bash
# List Maame databases
ssh big-vps 'sudo fleet db list | grep -E "maame|store_maameks"'

# Confirm hardening objects
ssh big-vps 'docker exec fleet-postgres psql -U postgres -d store_maameks -c "
  SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' ORDER BY 1;
"'

# Payment breakdown
ssh big-vps 'docker exec fleet-postgres psql -U postgres -d store_maameks -c "
  SELECT payment_status, count(*) FROM orders GROUP BY 1;
"'

# Health (after app deploy)
curl -s https://maamekskitchen.ca/api/health | jq .
```

Local dev:

```bash
DATABASE_URL="postgresql://store_maameks:CHANGE_ME@127.0.0.1:5432/store_maameks" npm run dev
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) | Table/column reference |
| [MIGRATION_STATUS_REPORT.md](./MIGRATION_STATUS_REPORT.md) | Migration file inventory |
| [SUPABASE_TO_POSTGRES_DATABASE_REPORT.md](./SUPABASE_TO_POSTGRES_DATABASE_REPORT.md) | Feature replacement matrix |
| [PAYMENT_DATABASE_AUDIT.md](./PAYMENT_DATABASE_AUDIT.md) | Stripe payment flow |
| [DATABASE_PERFORMANCE_REPORT.md](./DATABASE_PERFORMANCE_REPORT.md) | Indexes and query risks |
| [DATABASE_RECOVERY_GUIDE.md](./DATABASE_RECOVERY_GUIDE.md) | Backup/restore procedures |
| [SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) | Cutover playbook |

---

## Sign-off Checklist

| Item | Status |
|------|--------|
| Both DBs restored from live Supabase | Done |
| Integrity scan clean | Done |
| Hardening migration applied to both DBs | Done |
| `store_modules` seeded (10 rows) | Done |
| Coolify app + env vars | **Pending** |
| Storage migration | **Pending** |
| Stripe webhook URL updated to VPS | **Pending** |
| Production DNS cutover | **Pending** |
