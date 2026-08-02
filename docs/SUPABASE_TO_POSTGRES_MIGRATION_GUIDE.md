# Supabase → Plain Postgres Migration Guide

**Project:** Maame K's Kitchen (`maame-ks-kitchen`)  
**Branch:** `staging/plain-postgres`  
**Target:** Fleet VPS Postgres database `store_maameks`  
**Public URL:** `https://maamekskitchen.ca`

This is the project-specific playbook for cutting Maame K's Kitchen from hosted Supabase to plain Postgres on the big VPS. It is **not** a generic Ghanaian multi-gateway template — this store uses **Stripe only** for payments and **Moolre for SMS only**.

---

## Migration Strategy

The app keeps `@supabase/supabase-js` on the client. Instead of removing the SDK, we:

1. Point `NEXT_PUBLIC_SUPABASE_URL` at **this Next.js app** (not Supabase cloud).
2. Set `DATABASE_URL` so server code uses `lib/db/supabase-compat.ts` (pg Pool).
3. Serve GoTrue/PostgREST/Storage-compatible HTTP shims at `/auth/v1`, `/rest/v1`, `/storage/v1`.
4. Enforce security with application-level REST ACL (`lib/db/rest-acl.ts`) replacing Supabase RLS for HTTP access.

Server-side code uses `supabaseAdmin` from `lib/supabase-admin.ts`, which auto-selects compat vs hosted Supabase based on `DATABASE_URL`.

---

## Environment Variable Mapping

### Cutover set (plain Postgres on VPS)

Copy from `.env.example`. **Never commit real values.**

| Variable | Hosted Supabase (before) | Plain Postgres (after) |
|----------|-------------------------|------------------------|
| `DATABASE_URL` | *(unset)* | `postgresql://store_maameks:CHANGE_ME@127.0.0.1:5432/store_maameks` |
| `NEXT_PUBLIC_USE_PLAIN_PG` | `false` or unset | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | `https://maamekskitchen.ca` (app origin) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon JWT | Any non-empty string (ACL uses JWT when present) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role JWT | Strong random string (server jobs + ACL bypass) |
| `AUTH_JWT_SECRET` | *(Supabase-managed)* | **Required** — generate long random secret |
| `STORAGE_ROOT` | *(N/A)* | `/data/maameks/storage` (or fleet path) |
| `STORAGE_PUBLIC_URL` | Supabase project URL | `https://maamekskitchen.ca` |
| `STORAGE_SIGNING_SECRET` | *(N/A)* | Long random secret for signed URLs |
| `NEXT_PUBLIC_APP_URL` | Production domain | `https://maamekskitchen.ca` |

### Unchanged (same names, new values in Coolify)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API (CAD Checkout + Billing) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `RESEND_API_KEY` | Transactional email |
| `EMAIL_FROM` | Sender address |
| `ADMIN_EMAIL` | Admin notification recipient |
| `MOOLRE_SMS_API_KEY` or `MOOLRE_API_KEY` | SMS only (not payments) |
| `SMS_SENDER_ID` or `MOOLRE_SMS_SENDER_ID` | Default `MaameKitch` |
| `CRON_SECRET` | Protect `/api/cron/payment-reminders` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Optional bot protection |
| `RECAPTCHA_SECRET_KEY` | Optional |

### Remove after cutover (hosted Supabase only)

These are **not needed** once plain Postgres is verified:

- Supabase project URL as `NEXT_PUBLIC_SUPABASE_URL` (replaced by app origin)
- Real Supabase anon/service JWTs (replaced by local secrets)
- Any `SUPABASE_PROJECT_REF` used only for CLI link

### Not applicable for this project

| Variable | Reason |
|----------|--------|
| `HUBTEL_*` | Hubtel payments **not implemented** |
| `PAYSTACK_*` | Paystack payments **not implemented** |
| Moolre payment keys | Moolre is **SMS only** in this codebase |

---

## Database Provisioning (VPS)

### Current state

| Item | Value |
|------|-------|
| Database name | `store_maameks` |
| Source dump | `maame_staging_2026-08-02.dump` |
| Products | 30 |
| Categories | 12 |
| Orders | 30 |
| Auth users | 1 |

### Provision commands (fleet CLI on VPS)

```bash
# Inventory
sudo fleet db list

# If reprovisioning from scratch (destructive):
sudo fleet db provision maameks

# Restore from dump (example — adjust path)
pg_restore -d store_maameks --no-owner --no-acl /path/to/maame_staging_2026-08-02.dump
```

### Schema source of truth

Migrations live in `supabase/migrations/`:

| Migration | Contents |
|-----------|----------|
| `20260209000000_complete_schema.sql` | Core schema, `mark_order_paid`, RLS policies (legacy) |
| `20260507000000_food_restaurant_schema.sql` | Restaurant-specific columns |
| `20260604000000_preorder_events_categories.sql` | Events/preorder |
| `20260605000000_meal_prep_subscriptions.sql` | Stripe meal-prep tables |
| `20260705000000_proteins.sql` | Protein add-ons |
| `20260802000000_staging_db_hardening.sql` | contact/newsletter/payment_events/sms + RPCs |
| `20260802130000_store_role_bypassrls.sql` | `ALTER ROLE store_maameks BYPASSRLS` (required) |

**Critical:** leftover Supabase RLS on `auth.users` / `profiles` returns **zero rows** to the store role unless `BYPASSRLS` is granted. App ACL lives in Next.js, not Postgres RLS.

Apply via `npm run db:migrate` (uses `scripts/run-migration.mjs` + `DATABASE_URL`) or direct psql on VPS.

### Create additional admin user

```bash
CREATE_ADMIN_EMAIL=admin@example.com CREATE_ADMIN_PASSWORD=CHANGE_ME npm run create-admin
```

Uses `scripts/create-admin-user.mjs` — bcrypt hash + profiles row with `role: admin`.

---

## Application Shim Architecture

### Client (`lib/supabase.ts`)

Lazy-initialized `@supabase/supabase-js` client. In plain-PG mode all requests go to the app origin:

- `supabase.auth.signInWithPassword` → `POST /auth/v1/token?grant_type=password`
- `supabase.from('products').select(...)` → `GET /rest/v1/products?select=...`
- `supabase.storage.from('products').upload(...)` → `POST /storage/v1/object/products/...`

### Server admin (`lib/supabase-admin.ts`)

When `DATABASE_URL` is set, uses in-process `createClient()` from `lib/db/supabase-compat.ts` — **no HTTP hop**, full table access (bypasses REST ACL).

### REST ACL (replaces RLS for HTTP)

Files: `lib/db/rest-auth.ts`, `lib/db/rest-acl.ts`

Actor resolution order:
1. Service role key in `apikey` or `Authorization` header → full access
2. Bearer JWT → verify with `AUTH_JWT_SECRET`, check `app_metadata.role`
3. Anon key or missing → anonymous (public read/insert rules only)

### Auth shim (`app/auth/v1/[...path]/route.ts`)

| Endpoint | Status |
|----------|--------|
| `POST /token` (password, refresh) | Implemented |
| `POST /signup` | Implemented |
| `GET /user` | Implemented |
| `PUT /user` (password, metadata) | Implemented |
| `POST /recover` | **501 Not Implemented** — recovery email not wired |

### Storage shim

Local disk under `STORAGE_ROOT`. Buckets mirror Supabase bucket names (e.g. `products`). Public URLs:

```
{STORAGE_PUBLIC_URL}/storage/v1/object/public/{bucket}/{path}
```

`next.config.ts` `remotePatterns` already includes `maamekskitchen.ca` for `/storage/v1/object/public/**`.

---

## Cutover Procedure

### Phase 1 — Staging / production on VPS

- [x] Branch `staging/plain-postgres` with compat layer
- [x] Database `store_maameks` restored from live dump + hardening
- [x] REST ACL + `store_maameks BYPASSRLS`
- [x] Env at `/data/fleet/secrets/maameks_coolify.env`
- [x] Storage root `/data/maameks/storage`
- [x] Coolify app `maameks-app` (`7pu9ayfz316bixojsuqvs2ex`) — nixpacks, port 3000
  - Branch: `staging/plain-postgres`
  - Domains: `maamekskitchen.ca`, `www`, `maameks.169-58-8-203.sslip.io`
  - Storage volume: `/data/maameks/storage`
  - `DATABASE_URL` host: `fleet-postgres:5432` (not pgbouncer — IPv6 refuse from app net)
  - Redeploy: `sudo fleet deploy maameks-app`
- [x] DNS apex + www → `169.58.8.203`
- [x] `/api/health` OK (DB + Stripe + auth secret)
- [ ] Stripe Dashboard webhook → `https://maamekskitchen.ca/api/payment/stripe/webhook`
- [ ] Moolre SMS keys (health shows `sms: missing` until set)
- [ ] Copy historical Supabase Storage objects into `/data/maameks/storage` if needed

### Phase 2 — Go-live checklist

1. Confirm `https://maamekskitchen.ca/api/health` returns `"db":"ok"`.
2. Admin login at `/admin/login` (profile `role=admin`).
3. Register Stripe webhook endpoint + paste `STRIPE_WEBHOOK_SECRET` into env, recreate container.
4. Place a small live/test Checkout order and confirm `payment_events` + order paid.
5. Optionally promote the same config into a Coolify-managed app for `sudo fleet deploy`.

### Phase 3 — Decommission hosted Supabase

Only after 48h stable production:

1. Confirm no runtime imports of hosted Supabase URL.
2. Remove Supabase project env vars from deploy config.
3. Archive Supabase project (keep dump backup in `/data/fleet/backups`).

---

## Storage Migration

### Export from Supabase (if still accessible)

Use `migration-artifacts/dump_storage.js` or Supabase Dashboard → Storage → download buckets.

### Import to VPS

```bash
# Example layout
/data/maameks/storage/
  products/
    {uuid-or-filename}.jpg
  ...
```

Ensure bucket names match what the app expects (`products`, etc.). The storage shim serves from `{STORAGE_ROOT}/{bucket}/{path}`.

### URL updates

Product images in DB may still reference `*.supabase.co/storage/...`. Options:

1. Bulk SQL update to new public URLs, or
2. Keep Supabase hostname in `next.config.ts` `remotePatterns` temporarily during transition (already configured).

---

## Stripe Configuration

### Webhook events (required)

| Event | Handler |
|-------|---------|
| `checkout.session.completed` | Orders + meal-prep subscription activation |
| `customer.subscription.updated` | Sync subscription status |
| `customer.subscription.deleted` | Mark subscription cancelled |
| `invoice.paid` | Renew meal-prep billing period |

Webhook URL: `https://maamekskitchen.ca/api/payment/stripe/webhook`

### Currency

Orders use CAD (`order.currency` defaults to `CAD` in Checkout session creation).

---

## Password Recovery Gap

Plain-PG mode returns **501** on `POST /auth/v1/recover`. Options before go-live:

1. **Implement:** Send Resend email with reset token stored in DB (recommended).
2. **Disable:** Hide forgot-password link until implemented.
3. **Manual:** Admin resets password via `npm run create-admin` or direct DB update.

The forgot-password page already surfaces the 501 message to users.

---

## Verification Commands

```bash
# Local with DATABASE_URL set
npm run dev   # port 3004

# Health
curl http://localhost:3004/api/health

# Build (note: ignoreBuildErrors is true — fix debt separately)
npm run build

# On VPS via SSH
ssh big-vps 'sudo fleet db list | grep maameks'
```

### Post-cutover checks

| Check | Expected |
|-------|----------|
| `GET /api/health` | `db: "ok"`, `authSecret: "configured"` |
| Menu page | Products from Postgres |
| Admin login | JWT cookie, middleware passes |
| Stripe test checkout | Order → paid via webhook |
| Order tracking wrong email | 403 from `/api/orders/lookup` |
| SMS test (admin) | Sends or times out at 15s |

---

## Rollback Plan

If cutover fails:

1. Revert DNS to previous host (Vercel or Supabase-era deploy).
2. Unset `DATABASE_URL` in deploy env → app falls back to hosted Supabase via `supabase-admin.ts`.
3. Restore `NEXT_PUBLIC_SUPABASE_URL` to Supabase project URL.
4. Database on VPS remains intact for retry.

Dual-mode code paths remain until hosted Supabase is fully decommissioned.

---

## Related Files

| Path | Role |
|------|------|
| `lib/db/supabase-compat.ts` | PostgREST-compatible query builder |
| `lib/db/auth.ts` | bcrypt + JWT auth |
| `lib/db/pool.ts` | pg connection pool |
| `lib/db/rest-acl.ts` | HTTP table/RPC ACL |
| `lib/db/storage.ts` | Disk storage client |
| `lib/supabase-admin.ts` | Server admin client selector |
| `.env.example` | Env template (placeholders only) |
| `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` | Status matrix |
