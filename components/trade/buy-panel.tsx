"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderBuild, OrderQuote, OrderVerify, Side } from "@/lib/panta/schemas";
import { apiPost, ClientApiError, explainCode } from "@/lib/client/api";
import { compileInstructions, sendAndConfirm, classifyTxError, TxError } from "@/lib/solana/tx";
import { getBalances, MIN_SOL_FOR_TX, type Balances } from "@/lib/solana/balances";
import { cents, usdc } from "@/lib/format";

type Step =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "signing" }
  | { kind: "sending" }
  | { kind: "confirming"; signature: string }
  | { kind: "done"; signature: string; status: OrderVerify["status"]; shares: string; side: Side }
  | { kind: "error"; message: string };

const PRESETS = ["1", "5", "10", "25"];
const SLIPPAGE = [50, 100, 300];

function secondsLeft(expiresAt: string, now: number) {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
}

export function BuyPanel({
  marketId,
  yesPrice,
  noPrice,
  initialSide = "yes",
  onFilled,
}: {
  marketId: string;
  yesPrice: string | null;
  noPrice: string | null;
  initialSide?: Side;
  onFilled?: (fill: { signature: string; side: Side; amountUsdc: string; shares: string; avgPrice: string }) => void;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState("5");
  const [slippage, setSlippage] = useState(100);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const quoteSeq = useRef(0);
  const amountTouched = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setSide(initialSide), [initialSide]);

  const busy = step.kind === "building" || step.kind === "signing" || step.kind === "sending" || step.kind === "confirming";
  const amountValid = /^\d+(\.\d{1,6})?$/.test(amount) && Number(amount) > 0;
  const wallet = publicKey?.toBase58() ?? null;

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return setBalances(null);
    try {
      setBalances(await getBalances(connection, publicKey));
    } catch {
      setBalances(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  // Start from an amount the wallet can actually afford.
  useEffect(() => {
    if (!balances || amountTouched.current) return;
    if (balances.usdc < Number(amount) && balances.usdc >= 1) setAmount(String(Math.floor(balances.usdc)));
  }, [balances, amount]);

  const requestQuote = useCallback(async () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (!wallet || !amountValid || (balances !== null && balances.usdc < Number(amount))) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    setQuoteError(null);
    try {
      const q = await apiPost<OrderQuote>("/api/orders/quote", { wallet, marketId, side, amountUsdc: amount });
      if (seq === quoteSeq.current) setQuote(q);
    } catch (err) {
      if (seq !== quoteSeq.current) return;
      setQuote(null);
      const flaky = err instanceof ClientApiError && (err.code === "INVALID_MARKET_PARAMS" || err.code === "TIMEOUT" || err.code === "NETWORK");
      setQuoteError(
        flaky
          ? "Panta couldn't price this just now. Retrying…"
          : err instanceof ClientApiError
            ? explainCode(err.code, err.message)
            : "Couldn't get a quote.",
      );
      if (flaky) retryTimer.current = setTimeout(() => void requestQuote(), 3000);
    } finally {
      if (seq === quoteSeq.current) setQuoting(false);
    }
  }, [wallet, amountValid, marketId, side, amount, balances]);

  // Re-quote (debounced) whenever inputs change.
  useEffect(() => {
    if (busy) return;
    const t = setTimeout(() => void requestQuote(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, side, amount, marketId]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  // Countdown, and refresh the quote shortly before it expires.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = quote ? secondsLeft(quote.expiresAt, now) : 0;
  useEffect(() => {
    if (quote && left <= 3 && !busy && !quoting) void requestQuote();
  }, [quote, left, busy, quoting, requestQuote]);

  const insufficientUsdc = balances !== null && amountValid && balances.usdc < Number(amount);
  const insufficientSol = balances !== null && balances.sol < MIN_SOL_FOR_TX;

  async function confirm() {
    if (!publicKey || !signTransaction || !quote || !wallet) return;
    setStep({ kind: "building" });
    let build: OrderBuild;
    try {
      build = await apiPost<OrderBuild>("/api/orders/build", { quoteId: quote.quoteId, wallet, maxSlippageBps: slippage });
    } catch (err) {
      const code = err instanceof ClientApiError ? err.code : "";
      setStep({ kind: "error", message: err instanceof ClientApiError ? explainCode(code, err.message) : "Couldn't build the order." });
      if (code === "QUOTE_STALE" || code === "QUOTE_EXPIRED") void requestQuote();
      return;
    }

    let signature: string;
    try {
      setStep({ kind: "signing" });
      const tx = compileInstructions(build.instructions, publicKey, build.recentBlockhash);
      const signed = await signTransaction(tx);
      setStep({ kind: "sending" });
      signature = await sendAndConfirm(connection, signed, build.lastValidBlockHeight);
    } catch (err) {
      const e = err instanceof TxError ? err : classifyTxError(err);
      setStep({ kind: "error", message: e.message });
      if (e.kind === "expired") void requestQuote();
      return;
    }

    setStep({ kind: "confirming", signature });
    let status: OrderVerify["status"] = "submitted";
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await apiPost<OrderVerify & { attribution: string }>("/api/orders/confirm", {
          orderId: build.orderId,
          quoteId: quote.quoteId,
          signature,
          wallet,
          marketId,
        });
        status = res.status;
        if (status === "confirmed" || status === "failed") break;
      } catch {
        // Panta may not have indexed the signature yet; keep polling.
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    setStep({ kind: "done", signature, status, shares: build.expectedShares, side: build.side });
    onFilled?.({ signature, side: build.side, amountUsdc: build.amountUsdc, shares: build.expectedShares, avgPrice: quote.avgPrice });
    void refreshBalances();
    setQuote(null);
  }

  if (step.kind === "done") {
    return (
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-yes">
          {step.status === "confirmed" ? "Verified on-chain" : "Landed on-chain · Panta confirming"}
        </p>
        <p className="font-display text-2xl leading-tight">
          You hold {Number(step.shares).toFixed(2)} <span className={step.side === "yes" ? "text-yes" : "text-no"}>{step.side.toUpperCase()}</span> shares.
        </p>
        <p className="text-sm text-paper-dim">This position is now on your byline. It settles when the market resolves.</p>
        <div className="flex flex-wrap gap-2">
          <a href={`https://solscan.io/tx/${step.signature}`} target="_blank" rel="noreferrer" className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-paper-mute">
            View receipt ↗
          </a>
          {wallet ? (
            <a href={`/u/${wallet}`} className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-paper-mute">
              My byline
            </a>
          ) : null}
          <button type="button" onClick={() => setStep({ kind: "idle" })} className="rounded-full px-4 py-2 text-sm text-paper-dim hover:text-paper">
            Make another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Side">
        {(["yes", "no"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={side === s}
            disabled={busy}
            onClick={() => setSide(s)}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              side === s
                ? s === "yes"
                  ? "border-yes bg-yes-bg"
                  : "border-no bg-no-bg"
                : "border-line hover:border-line-strong"
            }`}
          >
            <span className={`block font-mono text-xs uppercase ${s === "yes" ? "text-yes" : "text-no"}`}>{s}</span>
            <span className="font-mono text-xl tabular">{cents(s === "yes" ? yesPrice : noPrice)}</span>
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="amount" className="mb-1.5 block text-xs text-paper-mute">
          Amount (USDC){balances ? <span className="float-right font-mono">Balance {usdc(balances.usdc)}</span> : null}
        </label>
        <div className="flex items-center rounded-xl border border-line bg-ink px-3 focus-within:border-paper-mute">
          <span className="font-mono text-paper-mute">$</span>
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            disabled={busy}
            onChange={(e) => {
              amountTouched.current = true;
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
            }}
            className="w-full bg-transparent px-2 py-3 font-mono text-lg tabular outline-none"
          />
        </div>
        <div className="mt-2 flex gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" disabled={busy} onClick={() => {
                amountTouched.current = true;
                setAmount(p);
              }} className="flex-1 rounded-lg border border-line py-1.5 font-mono text-xs text-paper-dim hover:border-line-strong hover:text-paper">
              ${p}
            </button>
          ))}
        </div>
      </div>

      {wallet ? (
        <div className="rounded-xl bg-ink p-3 font-mono text-sm tabular">
          {quoting && !quote ? (
            <p className="text-paper-mute">Getting a live quote…</p>
          ) : quote ? (
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-paper-mute">Shares</dt><dd>{Number(quote.shares).toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt className="text-paper-mute">Avg price</dt><dd>{cents(quote.avgPrice)}</dd></div>
              <div className="flex justify-between"><dt className="text-paper-mute">Fee</dt><dd>{usdc(quote.feeUsdc)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-paper-mute" title="Winning shares redeem from the market's pool, so the final payout can land below $1 per share.">
                  Payout if {side.toUpperCase()}
                </dt>
                <dd className="text-yes">up to {usdc(Number(quote.shares))}</dd>
              </div>
              <div className="flex justify-between pt-1 text-xs text-paper-mute">
                <dt>Quote refreshes in</dt>
                <dd>{quoting ? "…" : `${left}s`}</dd>
              </div>
            </dl>
          ) : quoteError ? (
            <p className="text-no">{quoteError}</p>
          ) : (
            <p className="text-paper-mute">Enter an amount to see your fill.</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-paper-mute">
        <span>Max slippage</span>
        {SLIPPAGE.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => setSlippage(s)} className={`rounded-md px-2 py-1 font-mono ${slippage === s ? "bg-ink-3 text-paper" : "hover:text-paper"}`}>
            {s / 100}%
          </button>
        ))}
      </div>

      {step.kind === "error" ? <p className="rounded-lg bg-no-bg px-3 py-2 text-sm text-no">{step.message}</p> : null}
      {insufficientUsdc ? <p className="text-sm text-no">This wallet has {usdc(balances?.usdc ?? 0)} USDC, which is less than the amount.</p> : null}
      {insufficientSol && !insufficientUsdc ? <p className="text-sm text-no">Add a little SOL (about {MIN_SOL_FOR_TX}) to cover network fees.</p> : null}

      {!wallet ? (
        <button type="button" onClick={() => setVisible(true)} className="w-full rounded-xl bg-accent py-3.5 font-semibold text-accent-ink hover:brightness-110">
          Connect wallet to back it
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!quote || busy || quoting || insufficientUsdc || insufficientSol || !signTransaction}
          className={`w-full rounded-xl py-3.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${side === "yes" ? "bg-yes text-ink" : "bg-no text-ink"}`}
        >
          {step.kind === "building"
            ? "Preparing order…"
            : step.kind === "signing"
              ? "Approve in your wallet…"
              : step.kind === "sending"
                ? "Sending to Solana…"
                : step.kind === "confirming"
                  ? "Confirming with Panta…"
                  : `Back ${side.toUpperCase()} · ${amountValid ? usdc(amount) : "$0.00"}`}
        </button>
      )}
      <p className="text-center text-[11px] text-paper-mute">
        Your wallet signs. Byline never holds your funds. Panta has no sell, so positions are held to resolution.
      </p>
    </div>
  );
}
