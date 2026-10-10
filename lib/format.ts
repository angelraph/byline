/** Parse a Panta decimal string. Returns null for missing or non-finite values. */
export function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 0.52 -> "52¢" */
export function cents(price: string | number | null | undefined): string {
  const n = typeof price === "number" ? price : num(price ?? null);
  if (n === null) return "—";
  return `${Math.round(n * 100)}¢`;
}

/** 0.52 -> "52%" */
export function pct(price: string | number | null | undefined, digits = 0): string {
  const n = typeof price === "number" ? price : num(price ?? null);
  if (n === null) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

const usdFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function usdc(v: string | number | null | undefined, opts: { compact?: boolean } = {}): string {
  const n = typeof v === "number" ? v : num(v ?? null);
  if (n === null) return "—";
  if (opts.compact && Math.abs(n) >= 10_000) return `$${usdCompact.format(n)}`;
  return `$${usdFmt.format(n)}`;
}

/** USDC base units (6 decimals) as integer string -> human number. */
export function fromBaseUnits(v: string | number): number {
  return Number(v) / 1_000_000;
}

export function signedPct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = (n * 100).toFixed(digits);
  return n > 0 ? `+${s}%` : `${s}%`;
}

export function shortAddr(addr: string, size = 4): string {
  if (addr.length <= size * 2 + 1) return addr;
  return `${addr.slice(0, size)}…${addr.slice(-size)}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(target: Date | number | string, now: number = Date.now()): string {
  const t = target instanceof Date ? target.getTime() : typeof target === "number" ? target : Date.parse(target);
  const diffSec = Math.round((t - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86_400), "day");
}

export function kickoffLabel(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function marketTitle(m: { title: string; description: string; marketId: string }): string {
  const t = m.title.trim();
  if (t) return t;
  const d = m.description.trim();
  if (d) return d.length > 120 ? `${d.slice(0, 117)}…` : d;
  return `Market ${shortAddr(m.marketId)}`;
}
