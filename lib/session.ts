import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "byline_session";
const SESSION_DAYS = 30;

/**
 * HMAC key for session tokens. SESSION_SECRET wins when set; otherwise the key is derived
 * from the server-only database URL, so deployments work without an extra secret.
 */
function key(): Uint8Array {
  const base = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!base) throw new Error("Sessions need SESSION_SECRET or DATABASE_URL");
  return new Uint8Array(createHash("sha256").update(`byline-session-v1:${base}`).digest());
}

export async function issueSession(wallet: string): Promise<void> {
  const token = await new SignJWT({ sub: wallet })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Wallet address of the signed-in user, or null. */
export async function sessionWallet(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** The exact message a wallet signs to sign in. Both sides build it the same way. */
export function signInMessage(wallet: string, nonce: string, issuedAt: string): string {
  return [
    "Sign in to BYLINE",
    "",
    "This signature proves you own this wallet so you can post calls and messages.",
    "It is free and gives no access to your funds.",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}
