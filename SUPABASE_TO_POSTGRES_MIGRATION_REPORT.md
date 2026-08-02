# Supabase → Plain Postgres Migration Report

**Project:** Maame K's Kitchen  
**Branch:** `staging/plain-postgres`  
**Report date:** 2026-08-02  
**Database:** `store_maameks` on fleet VPS  
**Dump:** `maame_staging_2026-08-02.dump`

---

## Overall Status

| Phase | Status |
|-------|--------|
| Code migration (compat layer) | **Complete** |
| Security repair pass | **Complete** |
| VPS database provision | **Complete** |
| Coolify app deploy | **Not started** |
| Storage file migration | **Not started** |
| DNS / production cutover | **Not started** |
| Hosted Supabase decommission | **Pending cutover** |

**Readiness:** Code is deploy-ready pending manual VPS/Coolify setup, env wiring, storage copy, and Stripe webhook URL update.

---

## Migration Status Matrix

| Component | Before (Supabase) | After (Plain Postgres) | Status | Notes |
|-----------|-------------------|------------------------|--------|-------|
| **Database** | Hosted Supabase Postgres | `store_maameks` on VPS | ✅ Restored | 30 products, 12 categories, 30 orders, 1 user |
| **Server data access** | `@supabase/supabase-js` service role | `supabaseAdmin` → `supabase-compat` + pg Pool | ✅ Done | Auto-detect via `DATABASE_URL` |
| **Client data access** | supabase-js → Supabase cloud | supabase-js → app origin shims | ✅ Done | `NEXT_PUBLIC_SUPABASE_URL` = app URL |
| **Auth** | Supabase GoTrue | `/auth/v1` shim + bcrypt + JWT | ⚠️ Partial | Password recovery returns 501 |
| **REST API** | Supabase PostgREST + RLS | `/rest/v1` shim + app ACL | ✅ Done | ACL replaces RLS for HTTP |
| **Storage** | Supabase Storage | Local disk `/storage/v1` shim | ⚠️ Partial | Shim ready; files not migrated |
| **RLS policies** | Postgres RLS enabled | Bypassed for HTTP; ACL in app | ✅ By design | In-process admin bypasses ACL |
| **Middleware admin auth** | Supabase getUser + profiles | JWT verify in plain-PG mode | ✅ Done | Also checks `DATABASE_URL` |
| **SSR (sitemap, SEO)** | Browser supabase client | `supabaseAdmin` server client | ✅ Done | menu, product, categories, sitemap |
| **Payments** | Stripe (unchanged) | Stripe (unchanged) | ✅ N/A | No payment migration needed |
| **SMS** | Moolre SMS | Moolre SMS | ✅ N/A | SMS only; 15s timeout added |
| **Email** | Resend | Resend | ✅ N/A | Unchanged |
| **Hubtel payments** | Never implemented | Never implemented | ➖ N/A | Not in codebase |
| **Paystack payments** | Never implemented | Never implemented | ➖ N/A | Not in codebase |
| **Health monitoring** | None | `/api/health` | ✅ Done | DB ping + env checks |
| **Order tracking security** | Client-side email check | `/api/orders/lookup` | ✅ Done | Server-side email match |
| **Pay page security** | Full order via client REST | `/api/orders/pay-info` | ✅ Done | Limited fields only |
| **Stripe webhook hardening** | No amount check | Amount vs order.total | ✅ Done | Rejects mismatch with 400 |
| **TypeScript build** | ignoreBuildErrors | ignoreBuildErrors | ❌ Debt | Still `true` in next.config |
| **Coolify app** | N/A (was Vercel/Supabase) | Fleet Coolify | ❌ Blocked | Manual UI step required |
| **Production env** | Supabase + Vercel vars | VPS Coolify vars | ❌ Pending | See `.env.example` |

**Legend:** ✅ Complete · ⚠️ Partial · ❌ Not done / blocked · ➖ Not applicable

---

## Data Migration Summary

| Table / entity | Records (dump) | Verified |
|----------------|------------------|----------|
| products | 30 | From dump metadata |
| categories | 12 | From dump metadata |
| orders | 30 | From dump metadata |
| auth.users | 1 | From dump metadata |
| storage objects | Unknown | **Not migrated** |

---

## Code Changes Summary

### Initial migration commit (`f7fdcc7`)

- Added entire plain-Postgres stack: `lib/db/*`, auth/rest/storage shims
- Ported full Maame K's Kitchen application to repo

### Repair session (uncommitted at audit time)

See [REPAIR_CHANGELOG.md](./REPAIR_CHANGELOG.md) for file-level detail.

Key additions:
- `lib/db/rest-acl.ts`, `lib/db/rest-auth.ts`
- `app/api/health/route.ts`
- `app/api/orders/lookup/route.ts`, `app/api/orders/pay-info/route.ts`
- SSR fixes, webhook amount validation, SMS timeout, password recovery 501

---

## Environment Checklist (Coolify)

Set these in Coolify before first deploy. Use placeholders from `.env.example` — **do not commit secrets**.

| Variable | Required | Set? |
|----------|----------|------|
| `DATABASE_URL` | Yes | ☐ |
| `AUTH_JWT_SECRET` | Yes (prod) | ☐ |
| `NEXT_PUBLIC_USE_PLAIN_PG` | Yes | ☐ |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (= app URL) | ☐ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ☐ |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | ☐ |
| `STORAGE_ROOT` | Yes | ☐ |
| `STORAGE_PUBLIC_URL` | Yes | ☐ |
| `STORAGE_SIGNING_SECRET` | Yes | ☐ |
| `NEXT_PUBLIC_APP_URL` | Yes | ☐ |
| `STRIPE_SECRET_KEY` | Yes | ☐ |
| `STRIPE_WEBHOOK_SECRET` | Yes | ☐ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | ☐ |
| `RESEND_API_KEY` | Yes | ☐ |
| `MOOLRE_SMS_API_KEY` | Optional | ☐ |
| `CRON_SECRET` | Recommended | ☐ |

---

## Manual Actions Before Go-Live

1. **Create Coolify app** for Maame K's Kitchen (owner/Coolify UI — cannot be done via SSH alone).
2. **Wire environment variables** in Coolify from checklist above.
3. **Generate and set `AUTH_JWT_SECRET`** — required for admin login and JWT REST auth.
4. **Copy storage files** from Supabase buckets to `STORAGE_ROOT` on VPS.
5. **Configure Stripe webhook** → `https://maamekskitchen.ca/api/payment/stripe/webhook`.
6. **Implement or disable password recovery** — currently returns 501 in plain-PG.
7. **Run production build** on VPS and fix TypeScript errors (remove `ignoreBuildErrors` when ready).
8. **DNS cutover** for `maamekskitchen.ca`.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Coolify app not created | Cannot deploy | Owner action in Coolify UI |
| Storage not migrated | Broken product images | Copy files before DNS cutover |
| AUTH_JWT_SECRET missing | Admin login fails in prod | Generate before deploy |
| Password recovery 501 | Users cannot self-reset | Implement Resend flow or hide link |
| Guest orders REST readable | Order enumeration by number | Use lookup API; tighten REST later |
| ignoreBuildErrors | Hidden type bugs in prod | Fix incrementally, disable flag |
| Cart cleared before Stripe | Lost cart on payment abandon | Defer clearCart until success (future) |

---

## Sign-Off Criteria

Migration is **complete** when all are true:

- [ ] Coolify app running with `GET /api/health` → 200
- [ ] Storefront loads menu from `store_maameks`
- [ ] Admin login and dashboard functional
- [ ] Stripe test payment → webhook → order paid
- [ ] Product images serve from VPS storage
- [ ] Order tracking rejects wrong email
- [ ] Meal-prep subscription flow works
- [ ] Hosted Supabase env vars removed from deploy
- [ ] DNS points to VPS

---

## References

- [docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) — detailed playbook
- [FULL_SYSTEM_AUDIT.md](./FULL_SYSTEM_AUDIT.md) — architecture and findings
- [.env.example](./.env.example) — environment template
