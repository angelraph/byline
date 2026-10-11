import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/route";
import { isDbConfigured } from "@/lib/db";
import { getDesk } from "@/lib/desks";
import { sessionWallet } from "@/lib/session";
import { cleanText, insertMessage, listMessages, recentMessageCount } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getDesk(slug)) return jsonError("NOT_FOUND", "Unknown desk", 404);
  if (!isDbConfigured()) return NextResponse.json({ messages: [] });
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  return NextResponse.json({ messages: await listMessages(slug, Number.isFinite(after) && after > 0 ? after : 0) });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getDesk(slug)) return jsonError("NOT_FOUND", "Unknown desk", 404);
  if (!isDbConfigured()) return jsonError("NOT_CONFIGURED", "Chat is unavailable right now.", 503);
  const wallet = await sessionWallet();
  if (!wallet) return jsonError("SIGN_IN_REQUIRED", "Sign in with your wallet to chat.", 401);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("BAD_REQUEST", "Request body must be JSON", 400);
  }
  const parsed = z.object({ body: z.string().min(1).max(400) }).safeParse(raw);
  if (!parsed.success) return jsonError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  const body = cleanText(parsed.data.body);
  if (!body) return jsonError("INVALID_INPUT", "Write something first.", 400);
  if ((await recentMessageCount(wallet, 10)) >= 5) return jsonError("RATE_LIMITED", "You're sending messages too fast.", 429);
  return NextResponse.json({ message: await insertMessage(slug, wallet, body) });
}
