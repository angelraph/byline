// Creates BYLINE's tables. Safe to re-run (every statement is IF NOT EXISTS).
// Usage: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(url);

const statements = [
  `create table if not exists calls (
    id uuid primary key default gen_random_uuid(),
    wallet text not null,
    market_id text not null,
    side text not null check (side in ('yes', 'no')),
    thesis text not null default '' check (char_length(thesis) <= 1000),
    kind text not null check (kind in ('verified', 'paper')),
    signature text unique,
    entry_price numeric,
    amount_usdc numeric,
    shares numeric,
    parent_id uuid references calls(id) on delete set null,
    stance text check (stance in ('back', 'fade')),
    created_at timestamptz not null default now()
  )`,
  `create index if not exists calls_market_idx on calls (market_id, created_at desc)`,
  `create index if not exists calls_wallet_idx on calls (wallet, created_at desc)`,
  `create index if not exists calls_created_idx on calls (created_at desc)`,
  `create index if not exists calls_parent_idx on calls (parent_id)`,
  `create table if not exists comments (
    id uuid primary key default gen_random_uuid(),
    market_id text not null,
    wallet text not null,
    body text not null check (char_length(body) between 1 and 500),
    created_at timestamptz not null default now()
  )`,
  `create index if not exists comments_market_idx on comments (market_id, created_at desc)`,
  `create table if not exists desk_messages (
    id bigserial primary key,
    desk text not null,
    wallet text not null,
    body text not null check (char_length(body) between 1 and 400),
    created_at timestamptz not null default now()
  )`,
  `create index if not exists desk_messages_idx on desk_messages (desk, id desc)`,
  `create table if not exists auth_nonces (
    nonce text primary key,
    expires_at timestamptz not null
  )`,
];

for (const s of statements) {
  await sql.query(s);
}
const tables = await sql.query(
  "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
);
console.log("Tables:", tables.map((t) => t.table_name).join(", "));
