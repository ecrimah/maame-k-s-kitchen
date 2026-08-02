# Supabase → Postgres Database Report

**Project:** Maame K's Kitchen  
**Report date:** 2026-08-02  
**Scope:** Database-layer feature replacement (not full app migration — see root `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` for deploy status)

This document maps **Supabase platform features** to their **plain PostgreSQL equivalents** for this store.

**Important:** This store uses **Stripe only** for payments and **Moolre for SMS only**. Hubtel and Paystack are **not implemented** — no database tables, RPCs, or env vars exist for those gateways.

---

## Feature Replacement Matrix

| Supabase feature | Plain Postgres replacement | DB impact | Status |
|------------------|---------------------------|-------------|--------|
| **Hosted Postgres** | `fleet-postgres` PG 16.14, DB `store_maameks` | Full schema + data restored from dump | ✅ Done |
| **PostgREST / auto API** | In-process `supabase-compat` + `/rest/v1` routes | Same table shapes; queries via `pg` Pool | ✅ Done |
| **Row Level Security** | Application REST ACL (`lib/db/rest-acl.ts`) | RLS policies remain in DB but HTTP path ignores them | ✅ By design |
| **GoTrue Auth** | `/auth/v1` shim + `auth.users` + bcrypt + JWT | `auth` schema preserved from dump | ⚠️ Recover 501 |
| **Realtime** | Not used | N/A | ➖ N/A |
| **Edge Functions** | Next.js API routes | Logic in `app/api/*` | ✅ Done |
| **Supabase Storage** | Local disk + `/storage/v1` shim | No `storage.objects` table required | ⚠️ Files pending |
| **Database webhooks** | Stripe webhook → Next.js | `payment_events` table for audit | ✅ Done |
| **Supabase Vault / secrets** | Coolify env vars | No DB extension | ✅ External |
| **pg_graphql** | Not used | N/A | ➖ N/A |
| **Hubtel payments** | Never existed | N/A | ➖ N/A |
| **Paystack payments** | Never existed | N/A | ➖ N/A |
| **Moolre payments** | Never existed | Moolre = SMS API only | ➖ N/A |
| **Stripe payments** | Unchanged integration | `orders.payment_*`, `payment_events`, RPC `mark_order_paid` | ✅ Done |
| **Database backups (Supabase)** | Fleet backup scripts | `/data/fleet/backups/` | ✅ VPS-side |
| **Supabase Dashboard SQL** | `psql` via SSH + fleet CLI | — | ✅ Done |
| **Migration runner (Supabase CLI)** | `npm run db:migrate` + manual VPS scripts | `supabase/migrations/*.sql` | ✅ Done |

**Legend:** ✅ Complete · ⚠️ Partial · ➖ Not applicable

---

## Data Plane Comparison

### Before (Supabase)

```
Browser/App → supabase-js → Supabase Cloud
                              ├── PostgREST (RLS enforced)
                              ├── GoTrue
                              ├── Storage API
                              └── Managed Postgres
```

### After (Plain Postgres)

```
Browser → supabase-js → Same Next.js origin
                           ├── /rest/v1  → Pool + ACL
                           ├── /auth/v1  → auth.users + JWT
                           └── /storage/v1 → local filesystem

Server  → supabaseAdmin → supabase-compat → Pool (no ACL)
```

---

## Schema Preservation

| Schema | Treatment |
|--------|-----------|
| `public` | All commerce tables retained; 4 tables added by hardening |
| `auth` | Full Supabase dump — `users`, `refresh_tokens`, etc. |
| `extensions` | `uuid-ossp` / `pgcrypto` as in dump |
| `storage` | **Not used** — files on disk, not Postgres metadata |

Approximate table count: **~44 public tables** + auth schema objects.

---

## Security Model Translation

| Concern | Supabase | Plain Postgres |
|---------|----------|----------------|
| Anonymous catalog read | RLS `SELECT` policies | REST ACL `PUBLIC_READ` set |
| Guest checkout insert | RLS insert policies | REST ACL `PUBLIC_INSERT` on orders |
| User-scoped data | RLS `auth.uid()` | ACL `USER_SCOPED_GET` + JWT |
| Admin operations | RLS `is_admin_or_staff()` | JWT role check + service role bypass |
| Webhook / cron | Service role key | `supabaseAdmin` direct pool |
| SQL injection | PostgREST parameterization | Compat layer parameterized queries |

**Residual risk:** Direct Postgres connection with a user-scoped JWT is **not** a supported access path; RLS may or may not align with ACL. Application assumes Pool access is server-side only.

---

## Auth Database Mapping

| Supabase concept | Plain PG implementation |
|------------------|-------------------------|
| `auth.users` | Same table; passwords verified with bcrypt |
| `auth.refresh_tokens` | Shim issues refresh tokens |
| JWT signing | `AUTH_JWT_SECRET` (local) |
| `profiles` trigger | `handle_new_user()` unchanged |
| `app_metadata.role` | Synced from `profiles.role` at login |
| Email recovery | **Not implemented** — returns HTTP 501 |

**Bootstrap admin:**

```bash
CREATE_ADMIN_EMAIL=admin@example.com CREATE_ADMIN_PASSWORD=CHANGE_ME npm run create-admin
```

---

## Storage Database Mapping

Supabase stored object metadata in `storage.buckets` / `storage.objects`. The plain-PG shim **does not** use those tables.

| Supabase | Replacement |
|----------|-------------|
| Bucket `products` | Directory `{STORAGE_ROOT}/products/` |
| Public URL | `{STORAGE_PUBLIC_URL}/storage/v1/object/public/products/{path}` |
| Signed URLs | HMAC via `STORAGE_SIGNING_SECRET` |

**DB column impact:** `products` / `product_images.url` may still contain old Supabase URLs until bulk-updated or proxied.

---

## Payments Database Mapping

| Supabase era | Plain Postgres |
|--------------|----------------|
| Stripe webhook → edge function | `app/api/payment/stripe/webhook/route.ts` |
| Order update via RPC | `mark_order_paid(order_ref, moolre_ref)` — **Stripe ref in legacy arg name** |
| Idempotency | New `payment_events` table |
| Meal-prep billing | `meal_prep_subscriptions` + Stripe subscription ids |

No Hubtel/Paystack columns exist. Do not add `hubtel_*` or `paystack_*` tables without explicit product requirements.

---

## SMS Database Mapping

| Component | Implementation |
|-----------|----------------|
| Provider | Moolre SMS API (env: `MOOLRE_SMS_API_KEY` or `MOOLRE_API_KEY`) |
| Payment linkage | **None** — SMS is notifications only |
| Audit table | `sms_messages` (created by hardening; writes pending in app code) |
| Legacy naming | `orders.metadata.moolre_reference` stores **Stripe** payment reference |

---

## Tables Created Post-Dump (Cutover Gap Fill)

These were referenced in application code but absent from the Supabase export:

| Table | Supabase equivalent | Plain PG |
|-------|---------------------|----------|
| `contact_submissions` | Would have been a custom table | Created in hardening |
| `newsletter_subscribers` | Custom / third-party | Created in hardening |
| `payment_events` | Webhook logs often external | Created in hardening |
| `sms_messages` | N/A | Created for audit trail |

---

## Environment Variable Database Mapping

| Variable | Database role |
|----------|---------------|
| `DATABASE_URL` | Primary app connection string |
| `PG_POOL_MAX` | Pool size (default 10) |
| `PGSSL` | Set `require` only if TLS needed |
| `AUTH_JWT_SECRET` | Signs JWTs validated by REST/auth shims |
| `NEXT_PUBLIC_USE_PLAIN_PG` | Feature flag (client behavior) |

**Placeholder example (never commit real values):**

```
DATABASE_URL=postgresql://store_maameks:CHANGE_ME@127.0.0.1:5432/store_maameks
```

---

## Dual-Mode Fallback

`lib/supabase-admin.ts` selects implementation:

- `DATABASE_URL` set → plain Postgres compat client
- `DATABASE_URL` unset → hosted Supabase SDK (legacy rollback)

This allows DNS rollback without code deploy during cutover window.

---

## Decommission Checklist (Hosted Supabase)

Execute only after 48h stable production on VPS:

- [ ] Confirm all reads/writes hit VPS (`DATABASE_URL` in prod)
- [ ] Final dump archived to `/data/fleet/backups/`
- [ ] Remove Supabase project URL from deploy env
- [ ] Revoke Supabase service role keys
- [ ] Optional: drop or disable RLS policies in a cleanup migration
- [ ] Optional: rename `moolre_ref` RPC parameter to `payment_ref` (breaking change — schedule carefully)

---

## Related Documentation

| Document | Focus |
|----------|-------|
| [SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) | Operational cutover steps |
| [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md) | Integrity audit results |
| [PAYMENT_DATABASE_AUDIT.md](./PAYMENT_DATABASE_AUDIT.md) | Stripe-specific DB flow |
| [DATABASE_RECOVERY_GUIDE.md](./DATABASE_RECOVERY_GUIDE.md) | Backup/restore |
| `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` (repo root) | Overall project status |
