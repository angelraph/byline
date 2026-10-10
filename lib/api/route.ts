import "server-only";
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { PantaError } from "@/lib/panta/client";

export const addressSchema = z.string().refine((v) => {
  try {
    new PublicKey(v);
    return true;
  } catch {
    return false;
  }
}, "Invalid address");

export const signatureSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/, "Invalid signature");

export type ApiError = { code: string; message: string; field?: string };

export function jsonError(code: string, message: string, status: number, field?: string) {
  return NextResponse.json<ApiError>({ code, message, ...(field ? { field } : {}) }, { status });
}

/** Wrap a route handler: parse the body with `schema`, map Panta and validation errors to JSON. */
export function handle<S extends z.ZodTypeAny, R>(schema: S, fn: (input: z.output<S>) => Promise<R>) {
  return async (req: Request) => {
    let body: unknown;
    try {
      body = req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();
    } catch {
      return jsonError("BAD_REQUEST", "Request body must be JSON", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError("INVALID_INPUT", issue?.message ?? "Invalid input", 400, issue?.path.join("."));
    }
    try {
      return NextResponse.json(await fn(parsed.data));
    } catch (err) {
      if (err instanceof PantaError) {
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        return jsonError(err.code, err.message, status, err.field);
      }
      console.error(err);
      return jsonError("INTERNAL_ERROR", "Something went wrong. Try again.", 500);
    }
  };
}
