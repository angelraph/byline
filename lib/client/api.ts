/** Typed fetch for BYLINE's own API routes (browser side). */
export class ClientApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

function isErrorBody(v: unknown): v is { code: string; message: string } {
  return typeof v === "object" && v !== null && "code" in v && "message" in v;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientApiError("NETWORK", "Network error. Check your connection and try again.", 0);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (isErrorBody(json)) throw new ClientApiError(json.code, json.message, res.status);
    throw new ClientApiError("HTTP_ERROR", `Request failed (${res.status})`, res.status);
  }
  return json as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new ClientApiError("NETWORK", "Network error. Check your connection and try again.", 0);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (isErrorBody(json)) throw new ClientApiError(json.code, json.message, res.status);
    throw new ClientApiError("HTTP_ERROR", `Request failed (${res.status})`, res.status);
  }
  return json as T;
}

/** Friendly copy for Panta error codes surfaced in the trade and create flows. */
export function explainCode(code: string, fallback: string): string {
  const map: Record<string, string> = {
    AMOUNT_TOO_SMALL: "That amount is below the market's minimum fill. Try a larger amount.",
    MARKET_NOT_IN_PRIMARY: "This market is no longer taking new positions.",
    QUOTE_EXPIRED: "The quote expired. A fresh one is loading.",
    QUOTE_STALE: "The price moved past your slippage limit. Review the new quote.",
    MARKET_NOT_FOUND: "This market couldn't be found on-chain.",
    RATE_LIMITED: "Too many requests right now. Wait a few seconds and try again.",
    NOT_CLAIMABLE: "Nothing is claimable on this market for this wallet.",
    NOT_MARKET_CREATOR: "Only the market creator can claim these fees.",
    MARKET_NOT_GRADUATED: "Creator fees unlock once the market graduates.",
    NO_CREATOR_FEES: "No creator fees have accrued yet.",
    DUPLICATE_MARKET: "You've already created a market with this exact question.",
    CREATE_EXPIRED: "The create session expired. Start again to get a fresh quote.",
    TX_NOT_FOUND: "Panta hasn't seen the transaction yet. It usually appears within seconds.",
    TX_FAILED: "The transaction failed on-chain.",
    NOT_CONFIGURED: "Trading is unavailable: the server's Panta key isn't configured.",
    INTERNAL_ERROR: "Panta couldn't complete that just now. Please try again in a moment.",
    HTTP_ERROR: "Panta couldn't complete that just now. Please try again in a moment.",
    TIMEOUT: "Panta took too long to respond. Please try again in a moment.",
  };
  if (map[code]) return map[code];
  // Panta sometimes returns the bare code as the message (e.g. quoting a graduated market).
  if (code === "INVALID_MARKET_PARAMS" && (fallback === code || !fallback)) {
    return "This market isn't accepting new positions right now.";
  }
  return fallback;
}
