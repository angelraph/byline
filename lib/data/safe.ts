import { PantaError } from "@/lib/panta/client";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

/** Run a data loader and turn failures into a user-facing message instead of a crash. */
export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof PantaError) {
      const message =
        err.code === "NOT_CONFIGURED"
          ? "Panta API key is not configured on this server."
          : err.code === "RATE_LIMITED"
            ? "Panta is rate limiting requests. Data will refresh shortly."
            : err.message;
      return { ok: false, error: message, code: err.code };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error", code: "UNKNOWN" };
  }
}
