"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Market } from "@/lib/panta/schemas";
import { marketTitle, usdc } from "@/lib/format";

function priceOf(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : null;
}

/** Rotating spotlight of live markets, in the style of the big prediction apps. */
export function FeaturedCarousel({ markets }: { markets: Market[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = markets.length;
  const go = useCallback((d: number) => setI((x) => (x + d + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => go(1), 6000);
    return () => clearInterval(t);
  }, [count, paused, go]);

  if (count === 0) return null;
  const m = markets[i];
  const yes = priceOf(m.yesPrice);
  const no = priceOf(m.noPrice);
  const chance = yes !== null ? Math.round(yes * 100) : null;

  return (
    <div
      className="card relative overflow-hidden p-5 sm:p-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured markets"
    >
      <div className="flex items-center justify-between text-xs text-paper-mute">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-accent">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          Featured · {m.category.replace(/-/g, " ")}
        </span>
        {count > 1 ? (
          <div className="flex items-center gap-2">
            <span className="tabular">{i + 1} of {count}</span>
            <button type="button" onClick={() => go(-1)} aria-label="Previous market" className="flex h-7 w-7 items-center justify-center rounded-full border border-line hover:border-accent">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Next market" className="flex h-7 w-7 items-center justify-center rounded-full border border-line hover:border-accent">›</button>
          </div>
        ) : null}
      </div>

      <div key={m.marketId} className="animate-fade-up" aria-live="polite">
        <Link href={`/m/${m.marketId}`} className="mt-4 flex items-start gap-3">
          {m.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="brand-gradient h-14 w-14 shrink-0 rounded-2xl" aria-hidden="true" />
          )}
          <h3 className="font-display text-xl font-semibold leading-snug hover:underline">{marketTitle(m)}</h3>
        </Link>

        {chance !== null && yes !== null && no !== null ? (
          <>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="font-display text-5xl font-bold leading-none tabular">{chance}%</p>
                <p className="mt-1 text-sm text-paper-mute">chance of YES</p>
              </div>
              <div className="text-right text-sm text-paper-mute">
                <p className="tabular">{usdc(m.totalVolumeUsdc ?? m.volumeUsdc, { compact: true })} vol</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-no-bg" aria-hidden="true">
              <div className="bar-grow h-full rounded-full bg-yes" style={{ width: `${chance}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link href={`/m/${m.marketId}?side=yes`} className="rounded-xl bg-yes-bg px-4 py-3 transition hover:bg-yes hover:text-ink">
                <span className="block text-sm font-semibold text-yes">Yes {(1 / yes).toFixed(2)}</span>
                <span className="block text-xs text-paper-mute">$1 returns up to ${(1 / yes).toFixed(2)}</span>
              </Link>
              <Link href={`/m/${m.marketId}?side=no`} className="rounded-xl bg-no-bg px-4 py-3 transition hover:bg-no hover:text-ink">
                <span className="block text-sm font-semibold text-no">No {(1 / no).toFixed(2)}</span>
                <span className="block text-xs text-paper-mute">$1 returns up to ${(1 / no).toFixed(2)}</span>
              </Link>
            </div>
          </>
        ) : (
          <Link href={`/m/${m.marketId}`} className="mt-6 block rounded-xl bg-ink-3 py-3 text-center text-sm font-medium text-paper-dim hover:text-paper">
            View market
          </Link>
        )}
      </div>

      {count > 1 ? (
        <div className="mt-5 flex justify-center gap-1.5" role="tablist" aria-label="Choose featured market">
          {markets.map((x, n) => (
            <button
              key={x.marketId}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Market ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-accent" : "w-1.5 bg-line-strong hover:bg-paper-mute"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
