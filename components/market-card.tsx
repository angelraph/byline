import Link from "next/link";
import type { Market } from "@/lib/panta/schemas";
import { marketTitle, num, odds, relativeTime, usdc } from "@/lib/format";

/** Market tile in the style of modern prediction apps: chance first, one-tap sides. */
export function MarketCard({ m, buyable }: { m: Market; buyable: boolean }) {
  const yes = num(m.yesPrice);
  const no = num(m.noPrice);
  const chance = yes !== null ? Math.round(yes * 100) : null;
  const volume = m.totalVolumeUsdc ?? m.volumeUsdc;
  return (
    <article className="card card-hover group flex h-full flex-col p-4">
      <Link href={`/m/${m.marketId}`} className="flex items-start gap-3">
        {m.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <span className="brand-gradient h-11 w-11 shrink-0 rounded-xl opacity-80" aria-hidden="true" />
        )}
        <h3 className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug text-paper group-hover:text-white">{marketTitle(m)}</h3>
        {chance !== null ? (
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-bold leading-none tabular">{chance}%</p>
            <p className="mt-0.5 text-[11px] text-paper-mute">chance</p>
          </div>
        ) : null}
      </Link>

      {chance !== null ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-no-bg" aria-hidden="true">
          <div className="bar-grow h-full rounded-full bg-yes" style={{ width: `${chance}%` }} />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {buyable && yes !== null && no !== null ? (
          <>
            <Link
              href={`/m/${m.marketId}?side=yes`}
              className="rounded-lg bg-yes-bg py-2 text-center text-sm font-semibold text-yes transition hover:bg-yes hover:text-ink"
            >
              Yes {odds(yes)}
            </Link>
            <Link
              href={`/m/${m.marketId}?side=no`}
              className="rounded-lg bg-no-bg py-2 text-center text-sm font-semibold text-no transition hover:bg-no hover:text-ink"
            >
              No {odds(no)}
            </Link>
          </>
        ) : (
          <Link href={`/m/${m.marketId}`} className="col-span-2 rounded-lg bg-ink-3 py-2 text-center text-sm font-medium text-paper-dim hover:text-paper">
            {m.resolved ? "View result" : "View market"}
          </Link>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-paper-mute">
        <span className="capitalize">{m.category.replace(/-/g, " ")}</span>
        <span className="tabular">
          {usdc(volume, { compact: true })} vol
          {buyable && m.endTime ? ` · closes ${relativeTime(m.endTime * 1000)}` : ""}
        </span>
      </div>
    </article>
  );
}
