import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

/* ---------- Row schemas (rows come back untyped from the driver) ---------- */

const numOrNull = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null ? null : Number(v)))
  .pipe(z.number().nullable());
const iso = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString()));

export const callRowSchema = z.object({
  id: z.string(),
  wallet: z.string(),
  market_id: z.string(),
  side: z.enum(["yes", "no"]),
  thesis: z.string(),
  kind: z.enum(["verified", "paper"]),
  signature: z.string().nullable(),
  entry_price: numOrNull,
  amount_usdc: numOrNull,
  shares: numOrNull,
  parent_id: z.string().nullable(),
  stance: z.enum(["back", "fade"]).nullable(),
  created_at: iso,
  backs: z.union([z.string(), z.number()]).transform(Number).default(0),
  fades: z.union([z.string(), z.number()]).transform(Number).default(0),
});
export type CallRow = z.infer<typeof callRowSchema>;

export const commentRowSchema = z.object({
  id: z.string(),
  market_id: z.string(),
  wallet: z.string(),
  body: z.string(),
  created_at: iso,
});
export type CommentRow = z.infer<typeof commentRowSchema>;

export const messageRowSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(Number),
  desk: z.string(),
  wallet: z.string(),
  body: z.string(),
  created_at: iso,
});
export type MessageRow = z.infer<typeof messageRowSchema>;

function parseRows<S extends z.ZodTypeAny>(schema: S, rows: unknown[]): z.output<S>[] {
  return rows.flatMap((r) => {
    const p = schema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

/** Collapse whitespace runs and strip control characters from user text. */
export function cleanText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------- Calls ---------- */

export async function listCalls(opts: { marketId?: string; wallet?: string; limit?: number }): Promise<CallRow[]> {
  const sql = db();
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const rows = await sql`
    select c.*,
      (select count(*) from calls b where b.parent_id = c.id and b.stance = 'back') as backs,
      (select count(*) from calls f where f.parent_id = c.id and f.stance = 'fade') as fades
    from calls c
    where (${opts.marketId ?? null}::text is null or c.market_id = ${opts.marketId ?? null})
      and (${opts.wallet ?? null}::text is null or c.wallet = ${opts.wallet ?? null})
    order by c.created_at desc
    limit ${limit}`;
  return parseRows(callRowSchema, rows);
}

export async function getCall(id: string): Promise<CallRow | null> {
  const rows = await db()`select c.*, 0 as backs, 0 as fades from calls c where c.id = ${id}::uuid`;
  return parseRows(callRowSchema, rows)[0] ?? null;
}

export async function recentCallCount(wallet: string, minutes: number): Promise<number> {
  const rows = await db()`select count(*)::int as n from calls where wallet = ${wallet} and created_at > now() - make_interval(mins => ${minutes})`;
  const n = rows[0]?.n;
  return typeof n === "number" ? n : Number(n ?? 0);
}

export async function insertCall(c: {
  wallet: string;
  marketId: string;
  side: "yes" | "no";
  thesis: string;
  kind: "verified" | "paper";
  signature: string | null;
  entryPrice: number | null;
  amountUsdc: number | null;
  shares: number | null;
  parentId: string | null;
  stance: "back" | "fade" | null;
}): Promise<CallRow> {
  const rows = await db()`
    insert into calls (wallet, market_id, side, thesis, kind, signature, entry_price, amount_usdc, shares, parent_id, stance)
    values (${c.wallet}, ${c.marketId}, ${c.side}, ${c.thesis}, ${c.kind}, ${c.signature}, ${c.entryPrice}, ${c.amountUsdc}, ${c.shares}, ${c.parentId}, ${c.stance})
    on conflict (signature) do update set thesis = excluded.thesis
    returning *, 0 as backs, 0 as fades`;
  const row = parseRows(callRowSchema, rows)[0];
  if (!row) throw new Error("Insert failed");
  return row;
}

/* ---------- Comments ---------- */

export async function listComments(marketId: string, limit = 50): Promise<CommentRow[]> {
  const rows = await db()`select * from comments where market_id = ${marketId} order by created_at desc limit ${Math.min(limit, 100)}`;
  return parseRows(commentRowSchema, rows);
}

export async function insertComment(marketId: string, wallet: string, body: string): Promise<CommentRow> {
  const rows = await db()`insert into comments (market_id, wallet, body) values (${marketId}, ${wallet}, ${body}) returning *`;
  const row = parseRows(commentRowSchema, rows)[0];
  if (!row) throw new Error("Insert failed");
  return row;
}

export async function recentCommentCount(wallet: string, seconds: number): Promise<number> {
  const rows = await db()`select count(*)::int as n from comments where wallet = ${wallet} and created_at > now() - make_interval(secs => ${seconds})`;
  return Number(rows[0]?.n ?? 0);
}

/* ---------- Desk chat ---------- */

export async function listMessages(desk: string, afterId: number, limit = 60): Promise<MessageRow[]> {
  const rows = await db()`
    select * from (
      select * from desk_messages where desk = ${desk} and id > ${afterId} order by id desc limit ${Math.min(limit, 100)}
    ) t order by id asc`;
  return parseRows(messageRowSchema, rows);
}

export async function insertMessage(desk: string, wallet: string, body: string): Promise<MessageRow> {
  const rows = await db()`insert into desk_messages (desk, wallet, body) values (${desk}, ${wallet}, ${body}) returning *`;
  const row = parseRows(messageRowSchema, rows)[0];
  if (!row) throw new Error("Insert failed");
  return row;
}

export async function recentMessageCount(wallet: string, seconds: number): Promise<number> {
  const rows = await db()`select count(*)::int as n from desk_messages where wallet = ${wallet} and created_at > now() - make_interval(secs => ${seconds})`;
  return Number(rows[0]?.n ?? 0);
}
