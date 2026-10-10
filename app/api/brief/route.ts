import { NextResponse } from "next/server";
import { z } from "zod";
import { briefHeadline } from "@/lib/brief";
import { AiError } from "@/lib/ai";
import { jsonError } from "@/lib/api/route";
import { PantaError } from "@/lib/panta/client";

export const maxDuration = 60;

const schema = z.object({ text: z.string().trim().min(15, "Paste a headline or a few sentences").max(4000) });

/** Small per-instance limiter: AI calls cost money, so cap bursts from one client. */
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 6;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return jsonError("RATE_LIMITED", "Too many briefs in a minute. Try again shortly.", 429);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("BAD_REQUEST", "Request body must be JSON", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  try {
    return NextResponse.json(await briefHeadline(parsed.data.text));
  } catch (err) {
    if (err instanceof AiError) {
      return jsonError(err.code === "NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : "AI_ERROR", err.code === "NOT_CONFIGURED" ? "AI briefs are switched off on this server." : "The AI couldn't write this brief. Try again.", err.code === "NOT_CONFIGURED" ? 503 : 502);
    }
    if (err instanceof PantaError) return jsonError(err.code, err.message, 502);
    console.error(err);
    return jsonError("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
