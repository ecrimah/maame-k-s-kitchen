-- Plain-Postgres apps enforce ACL in Next.js; the store DB role must bypass
-- leftover Supabase RLS or auth.users / profiles reads return zero rows.
ALTER ROLE store_maameks BYPASSRLS;
