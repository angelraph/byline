import { NextResponse } from "next/server";
import { z } from "zod";
import { addressSchema, jsonError } from "@/lib/api/route";
import { isDbConfigured } from "@/lib/db";
import { sessionWallet } from "@/lib/session";
import { cleanText, insertComment, listComments, recentCommentCount } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ comments: [] });
  const parsed = z.object({ market: addressSchema }).safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return jsonError("INVALID_INPUT", "Invalid market", 400);
  return NextResponse.json({ comments: await listComments(parsed.data.market) });
}

const postSchema = z.object({ marketId: addressSchema, body: z.string().min(1).max(500) });

export async function POST(req: Request) {
  if (!isDbConfigured()) return jsonError("NOT_CONFIGURED", "Comments are unavailable right now.", 503);
  const wallet = await sessionWallet();
  if (!wallet) return jsonError("SIGN_IN_REQUIRED", "Sign in with your wallet to comment.", 401);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("BAD_REQUEST", "Request body must be JSON", 400);
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return jsonError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  const body = cleanText(parsed.data.body);
  if (!body) return jsonError("INVALID_INPUT", "Write something first.", 400);
  if ((await recentCommentCount(wallet, 20)) >= 3) return jsonError("RATE_LIMITED", "Slow down a little. Try again in a few seconds.", 429);
  return NextResponse.json({ comment: await insertComment(parsed.data.marketId, wallet, body) });
}
