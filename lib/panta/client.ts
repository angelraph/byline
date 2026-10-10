import "server-only";
import { z } from "zod";
import { errorEnvelopeSchema } from "./schemas";

const BASE_URL = "https://live-api.panta.market/api/v1";

export class PantaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field?: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "PantaError";
  }
}

export function isPantaConfigured(): boolean {
  return Boolean(process.env.PANTA_API_KEY);
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Seconds to cache GET responses in the Next.js data cache. 0 disables caching. */
  revalidate?: number;
  userId?: string;
  /**
   * GET /positions/ intermittently answers 400/5xx for valid wallets and succeeds on retry.
   * Only enable this for idempotent reads.
   */
  retryTransient?: boolean;
  /** Abort a single attempt after this many ms (Panta occasionally hangs before a 504). */
  timeoutMs?: number;
};

const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Typed request against the Panta API. The API key never leaves the server. */
export async function pantaRequest<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  opts: RequestOptions = {},
): Promise<z.output<S>> {
  const key = process.env.PANTA_API_KEY;
  if (!key) throw new PantaError("NOT_CONFIGURED", "Panta API key is not configured", 503);

  const method = opts.method ?? "GET";
  const url = new URL(`${BASE_URL}${path.endsWith("/") ? path : `${path}/`}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { "X-Api-Key": key, Accept: "application/json" };
  if (method === "POST") headers["Content-Type"] = "application/json";
  if (opts.userId) headers["X-User-Id"] = opts.userId;

  const cached = method === "GET" && Boolean(opts.revalidate);

  for (let attempt = 0; ; attempt++) {
    // Uncached calls get a unique request id: Panta echoes it for log correlation, and it
    // stops Next.js render-time fetch memoization from replaying an earlier (bad) response.
    if (!cached) headers["X-Request-Id"] = crypto.randomUUID();
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
        method,
        headers,
        body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
        ...(cached ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      if (method === "GET" && attempt < MAX_RETRIES) continue;
      throw new PantaError(timedOut ? "TIMEOUT" : "NETWORK", timedOut ? "Panta took too long to respond" : "Couldn't reach Panta", 504);
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
      await sleep(Math.min(retryAfter, 5) * 1000 + Math.random() * 300);
      continue;
    }
    const transient = res.status >= 500 || (opts.retryTransient && res.status === 400);
    if (transient && method === "GET" && attempt < MAX_RETRIES + 1) {
      await sleep(400 * (attempt + 1) + Math.random() * 200);
      continue;
    }

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new PantaError("BAD_RESPONSE", "Panta returned a non-JSON response", res.status);
    }

    if (!res.ok) {
      const env = errorEnvelopeSchema.safeParse(json);
      const retryAfter = res.headers.get("Retry-After");
      throw new PantaError(
        env.success ? env.data.code : "HTTP_ERROR",
        env.success ? (env.data.message ?? env.data.code) : `Panta request failed (${res.status})`,
        res.status,
        env.success ? env.data.field : undefined,
        retryAfter ? Number(retryAfter) : undefined,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new PantaError("SCHEMA_MISMATCH", `Unexpected Panta response for ${path}`, 502);
    }
    return parsed.data;
  }
}
