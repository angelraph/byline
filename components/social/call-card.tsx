import Link from "next/link";
import { odds, relativeTime, shortAddr } from "@/lib/format";

export type CallView = {
  id: string;
  wallet: string;
  market_id: string;
  side: "yes" | "no";
  thesis: string;
  kind: "verified" | "paper";
  signature: string | null;
  entry_price: number | null;
  stance: "back" | "fade" | null;
  created_at: string;
  backs: number;
  fades: number;
};

/** One call: who, which side, at what price, why, and the receipt. Server- and client-safe. */
export function CallCard({
  call,
  marketTitle,
  showActions = true,
  viewer,
}: {
  call: CallView;
  marketTitle?: string;
  showActions?: boolean;
  viewer?: string | null;
}) {
  const yes = call.side === "yes";
  const own = viewer === call.wallet;
  return (
    <article className="card p-4">
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <Link href={`/u/${call.wallet}`} className="font-mono font-semibold text-paper hover:text-accent">
          {shortAddr(call.wallet)}
        </Link>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${yes ? "bg-yes-bg text-yes" : "bg-no-bg text-no"}`}>
          {call.stance ? `${call.stance === "back" ? "Copied" : "Against"} · ` : ""}
          {call.side.toUpperCase()}
          {call.entry_price !== null ? ` at ${odds(call.entry_price)}` : ""}
        </span>
        {call.kind === "verified" ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">Real bet</span>
        ) : (
          <span className="rounded-full bg-ink-3 px-2 py-0.5 font-medium text-paper-dim" title="Free picks are saved at the odds of the moment but have no money behind them, so they never count toward a record.">
            Free pick
          </span>
        )}
        <span className="ml-auto text-paper-mute">{relativeTime(call.created_at)}</span>
      </header>
      {marketTitle ? (
        <Link href={`/m/${call.market_id}`} className="mt-2 block text-sm font-semibold hover:underline">
          {marketTitle}
        </Link>
      ) : null}
      {call.thesis ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-paper">{call.thesis}</p> : null}
      <footer className="mt-3 flex flex-wrap items-center gap-2 text-xs text-paper-mute">
        {call.signature ? (
          <a href={`https://solscan.io/tx/${call.signature}`} target="_blank" rel="noreferrer" className="hover:text-accent">
            Receipt ↗
          </a>
        ) : null}
        <span>
          {call.backs} cop{call.backs === 1 ? "y" : "ies"} · {call.fades} against
        </span>
        {showActions && !own ? (
          <span className="ml-auto flex gap-2">
            <Link
              href={`/m/${call.market_id}?side=${call.side}&ref=${call.id}#back`}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${yes ? "bg-yes-bg text-yes hover:bg-yes hover:text-ink" : "bg-no-bg text-no hover:bg-no hover:text-ink"}`}
            >
              Copy bet
            </Link>
            <Link
              href={`/m/${call.market_id}?side=${yes ? "no" : "yes"}&ref=${call.id}#back`}
              className="rounded-lg bg-ink-3 px-3 py-1.5 font-semibold text-paper-dim transition hover:text-paper"
            >
              Bet against
            </Link>
          </span>
        ) : null}
      </footer>
    </article>
  );
}
