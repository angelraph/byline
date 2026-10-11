import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { jsonError, addressSchema } from "@/lib/api/route";
import { clearSession, issueSession, sessionWallet, signInMessage } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET: who is signed in. */
export async function GET() {
  return NextResponse.json({ wallet: await sessionWallet() });
}

const startSchema = z.object({ action: z.literal("start"), wallet: addressSchema });
const finishSchema = z.object({
  action: z.literal("finish"),
  wallet: addressSchema,
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
  issuedAt: z.string().datetime(),
  signature: z.string().min(40).max(120),
});
const logoutSchema = z.object({ action: z.literal("logout") });
const schema = z.union([startSchema, finishSchema, logoutSchema]);

/**
 * POST { action: "start", wallet } → message to sign.
 * POST { action: "finish", wallet, nonce, issuedAt, signature } → session cookie.
 * POST { action: "logout" } → clears the session.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("BAD_REQUEST", "Request body must be JSON", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  const input = parsed.data;

  if (input.action === "logout") {
    await clearSession();
    return NextResponse.json({ wallet: null });
  }
  if (!isDbConfigured()) return jsonError("NOT_CONFIGURED", "Sign-in is unavailable right now.", 503);
  const sql = db();

  if (input.action === "start") {
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    await sql`insert into auth_nonces (nonce, expires_at) values (${nonce}, now() + interval '10 minutes')`;
    // Opportunistic cleanup of expired nonces.
    await sql`delete from auth_nonces where expires_at < now()`;
    return NextResponse.json({ nonce, issuedAt, message: signInMessage(input.wallet, nonce, issuedAt) });
  }

  // finish: each nonce works once and only before it expires.
  const used = await sql`delete from auth_nonces where nonce = ${input.nonce} and expires_at > now() returning nonce`;
  if (used.length === 0) return jsonError("NONCE_EXPIRED", "That sign-in request expired. Try again.", 400);

  let valid = false;
  try {
    const message = new TextEncoder().encode(signInMessage(input.wallet, input.nonce, input.issuedAt));
    valid = nacl.sign.detached.verify(message, bs58.decode(input.signature), new PublicKey(input.wallet).toBytes());
  } catch {
    valid = false;
  }
  if (!valid) return jsonError("BAD_SIGNATURE", "The wallet signature didn't match.", 401);

  await issueSession(input.wallet);
  return NextResponse.json({ wallet: input.wallet });
}
