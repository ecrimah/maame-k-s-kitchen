# Migration Status Report

**Project:** Maame K's Kitchen  
**Report date:** 2026-08-02  
**Repo path:** `supabase/migrations/`  
**VPS databases:** `store_maameks`, `maame_staging`

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Repo migration files | 7 | All defined in codebase |
| Applied from repo (via dump + hardening) | 7 effective | Dump includes schema through `20260705000000`; hardening applied on VPS |
| Pending (requires new deploy / manual run) | 0 | — |
| VPS-only hardening | 1 | `20260802000000_staging_db_hardening.sql` applied to both DBs |

**Apply methods:**

| Method | Command / script | When to use |
|--------|------------------|-------------|
| Local / CI | `npm run db:migrate` → `scripts/run-migration.mjs` | Dev with `DATABASE_URL` |
| VPS hardening | `scripts/apply-staging-hardening.sh` | After copying SQL to `/tmp/` on VPS |
| Full restore | `psql` / `pg_restore` from fleet backup | Disaster recovery |

---

## Migration Inventory (Chronological)

### 1. `20260209000000_complete_schema.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | In dump + repo |
| **Scope** | Foundation schema |
| **Creates** | Enums, core RPCs, ~30 public tables, indexes, RLS policies |
| **Key objects** | `profiles`, `products`, `orders`, `order_items`, `customers`, `mark_order_paid` (v1), `handle_new_user`, `is_admin_or_staff` |
| **Notes** | Defines Supabase-era RLS; still present in DB after restore |

### 2. `20260218000000_allow_null_order_items_product_fks.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | In dump + repo |
| **Scope** | Order history preservation |
| **Changes** | `order_items.product_id` and `variant_id` nullable |
| **Reason** | Allow product deletion without losing order line snapshots |

### 3. `20260507000000_food_restaurant_schema.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | In dump + repo |
| **Scope** | Restaurant-specific product/order fields |
| **Changes** | Dietary flags, prep time, allergens; `orders.currency` default → CAD; delivery columns; `catering_requests`, `delivery_zones`, `daily_menu`; new `order_status` values |
| **Drops** | Generic e-commerce columns on products (weight, brand, vendor) |

### 4. `20260604000000_preorder_events_categories.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | In dump + repo |
| **Scope** | Preorder + events + Saturday menu |
| **Changes** | Product availability modes; `kitchen_events`; category seeds (sides, pastries, saturday-menu); `product_images.media_type` |

### 5. `20260605000000_meal_prep_subscriptions.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | In dump + repo |
| **Scope** | Stripe meal-prep subscriptions |
| **Creates** | `subscription_plans`, `meal_prep_weeks`, `meal_prep_week_items`, `meal_prep_subscriptions`, `meal_prep_selections` |
| **Changes** | `profiles.stripe_customer_id`; RLS policies on meal-prep tables |

### 6. `20260705000000_proteins.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | In dump + repo |
| **Scope** | Protein add-on options |
| **Creates** | `proteins` table + RLS + index |

### 7. `20260802000000_staging_db_hardening.sql`

| Attribute | Value |
|-----------|-------|
| **Status** | **Applied on VPS** to `store_maameks` and `maame_staging` |
| **Scope** | Plain-Postgres cutover gaps |
| **Creates** | `contact_submissions`, `newsletter_subscribers`, `payment_events`, `sms_messages` |
| **Alters** | `mark_order_paid` → idempotent v2 with `payment_transaction_id` |
| **Indexes** | Payment events uniqueness; order payment lookups |
| **Seeds** | `store_modules` (10 rows, `ON CONFLICT DO NOTHING`) |
| **Safe** | Additive only; no data drops |

---

## VPS Application Record

### Restore source

Live Supabase data was exported and fixed for plain Postgres compatibility:

```
/data/fleet/backups/maame_live_*.fixed.sql
```

Both databases were refreshed from this dump **before** hardening.

### Hardening script

`scripts/apply-staging-hardening.sh`:

1. Sources `/data/fleet/secrets/db-stack.env` for superuser credentials
2. Runs hardening SQL via `docker exec -i fleet-postgres psql`
3. Grants on all public tables/sequences/functions to role `store_maameks`
4. Verifies presence of new tables and `mark_order_paid`

**Databases targeted:**

```bash
apply_one store_maameks
apply_one maame_staging
```

### Post-apply verification (expected)

| Check | Expected |
|-------|----------|
| `to_regclass('public.contact_submissions')` | relation exists |
| `to_regclass('public.payment_events')` | relation exists |
| `count(*) FROM store_modules` | ≥ 10 |
| `mark_order_paid` in `pg_proc` | 1 |

---

## Migration vs Application Dependencies

| Migration object | Required by |
|------------------|-------------|
| `contact_submissions` | Contact page, `/api/health` |
| `newsletter_subscribers` | Newsletter component |
| `payment_events` | Stripe webhook (`lib/payment-events.ts`) |
| `sms_messages` | `/api/health` table check (future SMS logging) |
| `store_modules` seed | Admin layout module toggles |
| Idempotent `mark_order_paid` | `lib/fulfill-order-payment.ts`, Stripe webhook |

**Graceful degradation:** `recordPaymentEvent()` continues if `payment_events` is missing (logs warning). After hardening, full idempotency is active.

---

## Not in Repo (Supabase Cloud History)

The live Supabase project may contain migration history entries not mirrored as local SQL files. The **restored dump** is the authoritative state for:

- `auth` schema tables and grants
- Row-level data
- Legacy RLS policy definitions
- Any hotfix applied directly in Supabase before export

When reconciling drift, prefer:

1. Dump contents on VPS
2. Repo migrations (forward-only)
3. Supabase dashboard migration list (historical reference only)

---

## Forward Migration Checklist

When adding migration `20260803000000_example.sql`:

- [ ] Idempotent where possible (`IF NOT EXISTS`, `ON CONFLICT`)
- [ ] Test on `maame_staging` first
- [ ] Run integrity scans (orphans, duplicates)
- [ ] Update REST ACL if new public tables
- [ ] Update `/api/health` required tables if critical
- [ ] Document in this file and schema reference
- [ ] Apply to `store_maameks` after staging validation

---

## Rollback Notes

| Migration | Rollback difficulty |
|-----------|---------------------|
| Hardening (20260802) | Low for new tables (can drop if empty); **do not** revert `mark_order_paid` if payments processed |
| Meal prep (20260605) | High — has live subscription FK data |
| Complete schema | N/A — restore from backup instead |

**Preferred rollback:** Restore from `/data/fleet/backups/` (see `DATABASE_RECOVERY_GUIDE.md`).

---

## Related Files

| Path | Role |
|------|------|
| `scripts/run-migration.mjs` | Applies repo migrations sequentially |
| `scripts/apply-staging-hardening.sh` | VPS hardening runner |
| `scripts/create-admin-user.mjs` | Post-migrate admin bootstrap |
| `scripts/enable-rls.sql` | Optional RLS enable (legacy) |
| `docs/DATABASE_AUDIT_AND_REPAIR_REPORT.md` | Audit context |
