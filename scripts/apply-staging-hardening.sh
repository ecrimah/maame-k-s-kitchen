#!/usr/bin/env bash
set -euo pipefail
source /data/fleet/secrets/db-stack.env
SQL_FILE="${1:-/tmp/20260802000000_staging_db_hardening.sql}"

apply_one() {
  local DB="$1"
  echo "== applying hardening to $DB =="
  docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" -i fleet-postgres \
    psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 < "$SQL_FILE"
  docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
    psql -U postgres -d "$DB" -v ON_ERROR_STOP=0 -c "
      GRANT ALL ON ALL TABLES IN SCHEMA public TO store_maameks;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO store_maameks;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO store_maameks;
    " || true
  echo "== verify $DB =="
  docker exec -e PGPASSWORD="$POSTGRES_SUPERPASS" fleet-postgres \
    psql -U postgres -d "$DB" -Atc "
      SELECT 'contact_submissions='||to_regclass('public.contact_submissions');
      SELECT 'newsletter_subscribers='||to_regclass('public.newsletter_subscribers');
      SELECT 'payment_events='||to_regclass('public.payment_events');
      SELECT 'sms_messages='||to_regclass('public.sms_messages');
      SELECT 'store_modules='||count(*) FROM store_modules;
      SELECT 'mark_order_paid='||count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='mark_order_paid';
    "
}

apply_one store_maameks
apply_one maame_staging
echo DONE
