# Database Recovery Guide

**Project:** Maame K's Kitchen  
**Report date:** 2026-08-02  
**Databases:** `store_maameks` (production target), `maame_staging` (pre-deploy mirror)  
**Host:** VPS-local `fleet-postgres` (PostgreSQL 16.14) — **not** publicly exposed

This guide covers backup sources, restore procedures, and post-restore steps including the hardening migration. **Never commit or paste real passwords** — use placeholders and VPS secret files.

---

## Backup Inventory

### Primary source: live Supabase export (fixed SQL)

```
/data/fleet/backups/maame_live_*.fixed.sql
```

- Exported from hosted Supabase before/during cutover
- “Fixed” for plain Postgres compatibility (ownership, extensions, syntax)
- Used to refresh **both** `store_maameks` and `maame_staging`

### Fleet automated backups

```
/data/fleet/backups/
```

Fleet backup scripts run on the VPS schedule (verify with fleet owner). Typical layout:

| Pattern | Contents |
|---------|----------|
| `store_maameks_*.sql` / `.dump` | Point-in-time DB backups |
| `maame_live_*.fixed.sql` | Live Supabase migration artifact |
| Other `store_*` files | Sibling stores on same host |

### Repo artifacts (schema only)

```
supabase/migrations/*.sql
```

Schema + seeds — **not** a substitute for data backup. Use for greenfield provision or hardening re-apply.

### Application storage (non-DB)

Product images and uploads are **not** in Postgres:

```
/data/maameks/storage/     # example STORAGE_ROOT
```

Back up separately when `STORAGE_ROOT` is populated on VPS.

---

## Prerequisites

### Access

```bash
ssh big-vps
```

### Inventory commands

```bash
sudo fleet db list
ls -lah /data/fleet/backups/ | grep -i maame
docker ps | grep fleet-postgres
```

### Credentials (placeholders)

| Secret | Location |
|--------|----------|
| Postgres superuser password | `/data/fleet/secrets/db-stack.env` (`POSTGRES_SUPERPASS`) |
| App role password | Provisioned per DB — use `CHANGE_ME` in docs; real value in fleet secrets / Coolify |
| Connection string | `postgresql://store_maameks:CHANGE_ME@127.0.0.1:5432/store_maameks` |

---

## Recovery Scenarios

### Scenario A — Full restore from `maame_live_*.fixed.sql`

Use when database is corrupted, accidentally dropped, or you need to reset to last known Supabase snapshot.

**Impact:** Destructive to current DB contents. Stop the app first.

```bash
# 1. Identify backup file
BACKUP=$(ls -t /data/fleet/backups/maame_live_*.fixed.sql | head -1)
echo "Using: $BACKUP"

# 2. Optional: drop and recreate database (destructive)
source /data/fleet/secrets/db-stack.env
docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'store_maameks' AND pid <> pg_backend_pid();"

docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  psql -U postgres -c "DROP DATABASE IF EXISTS store_maameks;"

sudo fleet db provision maameks
# Or: CREATE DATABASE store_maameks OWNER store_maameks;

# 3. Restore
docker exec -i -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  psql -U postgres -d store_maameks -v ON_ERROR_STOP=1 < "$BACKUP"

# 4. Re-apply hardening (tables/RPC/indexes not in older dumps)
docker exec -i -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  psql -U postgres -d store_maameks -v ON_ERROR_STOP=1 \
  < /path/to/20260802000000_staging_db_hardening.sql

# 5. Re-grant app role
docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  psql -U postgres -d store_maameks -c "
    GRANT ALL ON ALL TABLES IN SCHEMA public TO store_maameks;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO store_maameks;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO store_maameks;
  "
```

Repeat for `maame_staging` if staging mirror must match.

### Scenario B — Restore from `pg_dump` / custom format

If fleet backups use custom format (`.dump`):

```bash
BACKUP=/data/fleet/backups/store_maameks_YYYY-MM-DD.dump

docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  pg_restore -U postgres -d store_maameks --clean --if-exists --no-owner --no-acl "$BACKUP"
```

Then re-apply hardening migration if backup predates `20260802`.

### Scenario C — Partial table restore

For single-table mistakes (e.g. accidental truncate):

1. Restore backup to temporary database `store_maameks_recovery`
2. Export specific table:

```bash
docker exec fleet-postgres pg_dump -U postgres -d store_maameks_recovery -t public.orders --data-only > /tmp/orders_only.sql
```

3. Merge carefully into production (watch FK order and sequences)

**Not recommended** for orders/payments without downtime — prefer full restore.

### Scenario D — Re-apply hardening only

If data is intact but hardening migration failed mid-way:

```bash
# Copy SQL from repo to VPS
scp supabase/migrations/20260802000000_staging_db_hardening.sql big-vps:/tmp/

# Run project script
ssh big-vps 'bash /path/to/apply-staging-hardening.sh /tmp/20260802000000_staging_db_hardening.sql'
```

Script location in repo: `scripts/apply-staging-hardening.sh`

---

## Post-Restore Verification

### 1. Connectivity

```bash
docker exec fleet-postgres psql -U postgres -d store_maameks -c "SELECT version();"
```

Expected: `PostgreSQL 16.14 ...`

### 2. Row counts (approximate)

```sql
SELECT 'products' AS t, count(*) FROM products
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users;
```

### 3. Hardening objects

```sql
SELECT to_regclass('public.payment_events') IS NOT NULL AS payment_events_ok;
SELECT count(*) FROM store_modules;  -- expect >= 10
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'mark_order_paid';
```

### 4. Integrity spot checks

```sql
-- Orphan order items
SELECT count(*) FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL;

-- Duplicate order numbers
SELECT order_number, count(*) FROM orders GROUP BY 1 HAVING count(*) > 1;

-- Profile/auth alignment
SELECT count(*) FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL;
```

All should return **0** problem rows.

### 5. Application health

After Coolify app is running:

```bash
curl -s https://maamekskitchen.ca/api/health | jq .
```

Expect `db: "ok"` and required tables `present`.

### 6. Auth bootstrap (if auth.users empty)

```bash
CREATE_ADMIN_EMAIL=admin@example.com CREATE_ADMIN_PASSWORD=CHANGE_ME npm run create-admin
```

Run from app container or local with `DATABASE_URL` pointing at restored DB.

---

## Creating a Manual Backup

### SQL plain format (human-readable)

```bash
source /data/fleet/secrets/db-stack.env
TS=$(date +%Y%m%d_%H%M%S)
docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  pg_dump -U postgres -d store_maameks --no-owner --no-acl \
  > "/data/fleet/backups/store_maameks_${TS}.sql"
```

### Custom compressed format

```bash
docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
  pg_dump -U postgres -d store_maameks -Fc --no-owner \
  -f "/data/fleet/backups/store_maameks_${TS}.dump"
```

### Pre-cutover checklist backup

Before DNS cutover or destructive migration:

1. Manual `pg_dump` both `store_maameks` and `maame_staging`
2. Copy `maame_live_*.fixed.sql` to off-VPS storage if not already
3. Export Stripe dashboard webhook config screenshot
4. Document env var **names** in Coolify (not values)

---

## Recovery Time Objectives (Guidance)

| Scenario | Est. RTO | Notes |
|----------|----------|-------|
| Re-apply hardening only | < 5 min | Non-destructive |
| Full restore from SQL dump (~small DB) | 10–30 min | Depends on dump size |
| Full restore + storage sync | 1–2 hours | Image files separate |
| Rollback to hosted Supabase | 15 min DNS | Keep dual-mode env until decommission |

---

## Stripe & Payment Recovery Notes

After DB restore:

1. **Webhook idempotency** — `payment_events` may be empty; Stripe may retry recent events. Idempotent `mark_order_paid` prevents double stock reduction.
2. **Replay webhooks** — Use Stripe Dashboard → Events → Resend if orders stuck in pending after restore.
3. **Do not** replay Hubtel/Paystack — not applicable to this store.

---

## Staging Database (`maame_staging`)

| Aspect | Detail |
|--------|--------|
| Purpose | Pre-production testing mirror |
| Coolify app | **Not created** — no public staging URL |
| Restore | Same procedure as `store_maameks` with `-d maame_staging` |
| Hardening | Applied in parallel via `apply-staging-hardening.sh` |

Use staging for destructive tests before touching production DB.

---

## Emergency Contacts & Escalation

| Step | Action |
|------|--------|
| 1 | Stop Coolify app to prevent writes during restore |
| 2 | Notify store owner — orders during outage may need manual reconciliation |
| 3 | Restore from latest **pre-incident** backup |
| 4 | Re-apply hardening + verify integrity |
| 5 | Resume app; monitor `/api/health` and Stripe webhook logs |
| 6 | Document incident in audit report |

---

## Related Documents

| Document | Focus |
|----------|-------|
| [DATABASE_AUDIT_AND_REPAIR_REPORT.md](./DATABASE_AUDIT_AND_REPAIR_REPORT.md) | Baseline state |
| [MIGRATION_STATUS_REPORT.md](./MIGRATION_STATUS_REPORT.md) | Hardening migration |
| [SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) | Cutover rollback |
| `scripts/apply-staging-hardening.sh` | VPS hardening runner |

---

## Quick Reference Card

```
Backup path:     /data/fleet/backups/maame_live_*.fixed.sql
Container:       fleet-postgres
Production DB:   store_maameks
Staging DB:      maame_staging
Hardening SQL:   supabase/migrations/20260802000000_staging_db_hardening.sql
App connection:  postgresql://store_maameks:CHANGE_ME@127.0.0.1:5432/store_maameks
Health endpoint: GET /api/health
```
