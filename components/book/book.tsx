"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import type { BylineStats, CallRecord } from "@/lib/stats";
import type { ClaimBuild, CreatorFeesBuild, Market } from "@/lib/panta/schemas";
import { apiGet, apiPost, ClientApiError, explainCode } from "@/lib/client/api";
import { classifyTxError } from "@/lib/solana/tx";
import { useSendInstructions } from "@/lib/solana/use-send-instructions";
import { odds, fromBaseUnits, marketTitle, pct, shortAddr, signedPct, usdc } from "@/lib/format";
import { EmptyState, Notice, SectionHeader } from "@/components/ui";

type PositionsResponse = { calls: CallRecord[]; stats: BylineStats };

function errorText(err: unknown): string {
  if (err instanceof ClientApiError) return explainCode(err.code, err.message);
  return classifyTxError(err).message;
}

function ClaimWin({ wallet, call, onDone }: { wallet: string; call: CallRecord; onDone: () => void }) {
  const send = useSendInstructions();
  const [state, setState] = useState<{ kind: "idle" | "working" | "done" | "error"; msg?: string }>({ kind: "idle" });

  async function run() {
    setState({ kind: "working" });
    try {
      const build = await apiPost<ClaimBuild>("/api/claims/win", { wallet, marketId: call.marketId });
      const signature = await send(build);
      // Attribution is best-effort; the claim itself already landed.
      await apiPost("/api/claims/report", { wallet, marketId: call.marketId, signature }).catch(() => undefined);
      setState({ kind: "done", msg: signature });
      onDone();
    } catch (err) {
      setState({ kind: "error", msg: errorText(err) });
    }
  }

  if (state.kind === "done") {
    return (
      <a href={`https://solscan.io/tx/${state.msg}`} target="_blank" rel="noreferrer" className="text-sm text-yes">
        Claimed ↗
      </a>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={state.kind === "working"}
        className="rounded-full bg-yes px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {state.kind === "working" ? "Claiming…" : "Claim winnings"}
      </button>
      {state.kind === "error" ? <p className="max-w-56 text-right text-xs text-no">{state.msg}</p> : null}
    </div>
  );
}

function ClaimFees({ wallet, market }: { wallet: string; market: Market }) {
  const send = useSendInstructions();
  const [state, setState] = useState<{ kind: "idle" | "working" | "done" | "error"; msg?: string }>({ kind: "idle" });

  async function run() {
    setState({ kind: "working" });
    try {
      const build = await apiPost<CreatorFeesBuild>("/api/claims/creator-fees", { wallet, marketId: market.marketId });
      const signature = await send(build);
      setState({ kind: "done", msg: `${usdc(fromBaseUnits(build.claimableFeesUsdc))}|${signature}` });
    } catch (err) {
      setState({ kind: "error", msg: errorText(err) });
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 p-4">
      <div className="min-w-0">
        <Link href={`/m/${market.marketId}`} className="line-clamp-1 text-sm hover:underline">{marketTitle(market)}</Link>
        <p className="mt-1 font-mono text-xs text-paper-mute">
          {market.isGraduated ? "Your creator fees are ready to collect" : "Creator fees unlock once the market has enough betting"}
        </p>
        {state.kind === "error" ? <p className="mt-1 text-xs text-no">{state.msg}</p> : null}
      </div>
      {state.kind === "done" ? (
        <a href={`https://solscan.io/tx/${state.msg?.split("|")[1]}`} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-yes">
          Claimed {state.msg?.split("|")[0]} ↗
        </a>
      ) : (
        <button
          type="button"
          onClick={() => void run()}
          disabled={!market.isGraduated || state.kind === "working"}
          className="shrink-0 rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.kind === "working" ? "Claiming…" : "Claim fees"}
        </button>
      )}
    </li>
  );
}

export function Book() {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const wallet = publicKey?.toBase58() ?? null;

  const positions = useSWR<PositionsResponse, Error>(
    wallet ? `/api/positions?wallet=${wallet}` : null,
    (url: string) => apiGet<PositionsResponse>(url),
    { refreshInterval: 30_000 },
  );
  const created = useSWR<{ markets: Market[] }, Error>(
    wallet ? `/api/creator-markets?wallet=${wallet}` : null,
    (url: string) => apiGet<{ markets: Market[] }>(url),
  );

  if (!wallet) {
    return (
      <EmptyState
        title="Connect your wallet to see your bets"
        body="Your positions, winnings to claim, and creator fees, all read from Panta for the connected wallet."
        action={
          <button type="button" onClick={() => setVisible(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
            Connect wallet
          </button>
        }
      />
    );
  }

  const calls = positions.data?.calls ?? [];
  const stats = positions.data?.stats;
  const claimable = calls.filter((c) => c.claimable && !c.claimed);
  const open = calls.filter((c) => c.status === "open");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent">Your wallet</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">My bets</h1>
        </div>
        <Link href={`/u/${wallet}`} className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-paper-mute">
          My public record · {shortAddr(wallet)}
        </Link>
      </div>

      {positions.error ? (
        <Notice tone="error">
          {positions.error instanceof ClientApiError ? explainCode(positions.error.code, positions.error.message) : "Positions are delayed."} Retrying automatically.
        </Notice>
      ) : null}

      {stats ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 font-mono tabular">
          <div className="rounded-xl border border-line bg-ink-2 p-4">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">Open value</dt>
            <dd className="mt-1 text-2xl">{usdc(stats.openValue)}</dd>
            <p className="text-xs text-paper-mute">cost {usdc(stats.openCost)}</p>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-4">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">To claim</dt>
            <dd className="mt-1 text-2xl text-yes">{claimable.length}</dd>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-4">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">Record</dt>
            <dd className="mt-1 text-2xl">{stats.resolved ? `${stats.wins}–${stats.losses}` : "—"}</dd>
            <p className="text-xs text-paper-mute">{stats.hitRate !== null ? `${pct(stats.hitRate)} hit` : "no resolved calls"}</p>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-4">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">ROI</dt>
            <dd className={`mt-1 text-2xl ${stats.roi !== null && stats.roi < 0 ? "text-no" : "text-yes"}`}>{signedPct(stats.roi)}</dd>
          </div>
        </dl>
      ) : positions.isLoading ? (
        <p className="text-sm text-paper-mute">Loading your positions from Panta…</p>
      ) : null}

      {claimable.length > 0 ? (
        <section>
          <SectionHeader kicker="Winnings" title="Ready to claim" />
          <ul className="space-y-2">
            {claimable.map((c) => (
              <li key={`${c.marketId}-${c.side}`} className="flex items-center justify-between gap-3 rounded-xl border border-yes/40 bg-yes-bg p-4">
                <div className="min-w-0">
                  <Link href={`/m/${c.marketId}`} className="line-clamp-1 text-sm hover:underline">{c.title || `Market ${shortAddr(c.marketId)}`}</Link>
                  <p className="mt-1 font-mono text-xs text-paper-dim">
                    {c.side.toUpperCase()} · {c.shares.toFixed(2)} winning shares
                  </p>
                </div>
                <ClaimWin wallet={wallet} call={c} onDone={() => void positions.mutate()} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionHeader kicker="Live" title={`Open bets (${open.length})`} />
        {open.length === 0 && !positions.isLoading ? (
          <EmptyState
            title="Nothing open"
            body="Back a market and your position shows here as soon as Panta indexes it, usually within seconds."
            action={<Link href="/wire" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Find a market</Link>}
          />
        ) : (
          <ul className="space-y-2">
            {open.map((c) => (
              <li key={`${c.marketId}-${c.side}`}>
                <Link href={`/m/${c.marketId}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 p-4 hover:border-line-strong">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm">{c.title || `Market ${shortAddr(c.marketId)}`}</p>
                    <p className="mt-1 font-mono text-xs text-paper-dim">
                      <span className={c.side === "yes" ? "text-yes" : "text-no"}>{c.side.toUpperCase()}</span> · {c.shares.toFixed(2)} sh
                      {c.entryPrice !== null ? ` at ${odds(c.entryPrice)}` : ""}
                    </p>
                  </div>
                  <div className="text-right font-mono text-sm tabular">
                    <p>{usdc(c.currentValue)}</p>
                    {c.cost !== null && c.cost > 0 && c.currentValue !== null ? (
                      <p className={`text-xs ${c.currentValue >= c.cost ? "text-yes" : "text-no"}`}>
                        {signedPct((c.currentValue - c.cost) / c.cost)}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader kicker="Creator" title="Markets you created" />
        {created.error ? (
          <Notice tone="warn">Couldn&apos;t load your created markets right now.</Notice>
        ) : (created.data?.markets.length ?? 0) === 0 ? (
          <p className="text-sm text-paper-mute">
            {created.isLoading ? "Checking…" : "Markets you create in Forge appear here, with a button to claim creator fees once they graduate."}
          </p>
        ) : (
          <ul className="space-y-2">
            {created.data?.markets.map((m) => <ClaimFees key={m.marketId} wallet={wallet} market={m} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
