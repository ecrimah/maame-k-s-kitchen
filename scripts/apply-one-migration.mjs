/**
 * Apply a single migration file by name, probing pooler regions.
 * Usage: node scripts/apply-one-migration.mjs <migration-filename.sql>
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf-8').split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l.trim()))
      .map((l) => { const eq = l.indexOf('='); return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]; })
  );
}

const env = { ...process.env, ...loadEnv() };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = SUPABASE_URL?.match(/([a-zA-Z0-9]{20,})\.supabase\.co/)?.[1];
const file = process.argv[2];
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', file);
const sql = fs.readFileSync(migrationPath, 'utf-8');
const pw = encodeURIComponent(env.SUPABASE_DB_PASSWORD);

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-central-1',
  'eu-central-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'ap-northeast-1', 'ap-northeast-2', 'sa-east-1',
];

const candidates = [];
if (env.DATABASE_URL) candidates.push(['DATABASE_URL', env.DATABASE_URL]);
for (const prefix of ['aws-0', 'aws-1']) {
  for (const r of regions) {
    candidates.push([`${prefix}-${r}:6543`, `postgresql://postgres.${PROJECT_REF}:${pw}@${prefix}-${r}.pooler.supabase.com:6543/postgres`]);
    candidates.push([`${prefix}-${r}:5432`, `postgresql://postgres.${PROJECT_REF}:${pw}@${prefix}-${r}.pooler.supabase.com:5432/postgres`]);
  }
}

async function tryOne(label, connStr) {
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query(sql);
    await client.end();
    return true;
  } catch (err) {
    try { await client.end(); } catch {}
    const msg = err.message || '';
    // Only log meaningful (non-DNS) errors
    if (!/ENOTFOUND|ETIMEDOUT|EHOSTUNREACH/.test(msg)) console.log(`${label}: ${msg}`);
    return false;
  }
}

for (const [label, connStr] of candidates) {
  const ok = await tryOne(label, connStr);
  if (ok) { console.log(`SUCCESS via ${label}: applied ${file}`); process.exit(0); }
}
console.error('Could not connect to database via any region.');
process.exit(1);
