/**
 * Plain-Postgres mode is active when DATABASE_URL (or POSTGRES_URL) is set.
 * Client cutover also requires NEXT_PUBLIC_SUPABASE_URL = app origin and
 * NEXT_PUBLIC_USE_PLAIN_PG=true so middleware uses local JWT verification.
 */
export function isPlainPostgres(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export function authJwtSecret(): string {
  const secret =
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_JWT_SECRET (or JWT_SECRET) must be set in production"
    );
  }
  return "dev-auth-secret-change-me";
}
