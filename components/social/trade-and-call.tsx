"use client";

import { useState } from "react";
import { mutate } from "swr";
import type { Side } from "@/lib/panta/schemas";
import { BuyPanel } from "@/components/trade/buy-panel";
import { apiPost, ClientApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { shortAddr } from "@/lib/format";

type Fill = { signature: string; side: Side; amountUsdc: string; shares: string; avgPrice: string };
type ParentInfo = { id: string; wallet: string; side: Side } | null;

function ThesisForm({
  label,
  placeholder,
  submitLabel,
  required,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  required: boolean;
  onSubmit: (thesis: string) => Promise<void>;
}) {
  const { wallet, signIn, signingIn, error: authError } = useSession();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const who = wallet ?? (await signIn());
    if (!who) return;
    setBusy(true);
    try {
      await onSubmit(text);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2">
      <label className="block text-xs text-paper-mute" htmlFor="thesis">{label}</label>
      <textarea
        id="thesis"
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-paper-mute">{text.length}/1000</span>
        <button
          type="submit"
          disabled={busy || signingIn || (required && text.trim().length === 0)}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {signingIn ? "Check your wallet…" : busy ? "Posting…" : wallet ? submitLabel : `Sign in & ${submitLabel.toLowerCase()}`}
        </button>
      </div>
      {error || authError ? <p className="text-xs text-no">{error ?? authError}</p> : null}
    </form>
  );
}

export function TradeAndCall({
  marketId,
  yesPrice,
  noPrice,
  initialSide,
  parent,
  socialEnabled,
}: {
  marketId: string;
  yesPrice: string | null;
  noPrice: string | null;
  initialSide: Side;
  parent: ParentInfo;
  socialEnabled: boolean;
}) {
  const [fill, setFill] = useState<Fill | null>(null);
  const [posted, setPosted] = useState(false);
  const [mode, setMode] = useState<"back" | "paper">("back");
  const feedKey = `/api/calls?market=${marketId}`;

  const relation = parent ? (parent.side === initialSide ? "Backing" : "Fading") : null;

  async function postCall(body: Record<string, unknown>) {
    await apiPost("/api/calls", { marketId, ...(parent ? { parentId: parent.id } : {}), ...body });
    setPosted(true);
    await mutate(feedKey);
  }

  return (
    <div className="space-y-4">
      {parent ? (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-paper">
          {relation === "Backing" ? "Copying" : "Betting against"} <span className="font-mono font-semibold">{shortAddr(parent.wallet)}</span>&apos;s {parent.side.toUpperCase()} pick
        </p>
      ) : null}

      {socialEnabled ? (
        <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-0.5 text-xs font-medium" role="tablist">
          {(["back", "paper"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full py-1.5 transition ${mode === m ? "bg-accent text-accent-ink" : "text-paper-dim hover:text-paper"}`}
            >
              {m === "back" ? "Real bet" : "Free pick"}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "back" || !socialEnabled ? (
        <>
          <BuyPanel marketId={marketId} yesPrice={yesPrice} noPrice={noPrice} initialSide={initialSide} onFilled={(f) => setFill(f)} />
          {fill && socialEnabled && !posted ? (
            <div className="border-t border-line pt-4">
              <ThesisForm
                label="Add your reason (optional). It shows with your bet on your record."
                placeholder="Why this side? Form, injuries, a hunch…"
                submitLabel="Post my reason"
                required={false}
                onSubmit={(thesis) =>
                  postCall({
                    side: fill.side,
                    thesis,
                    signature: fill.signature,
                    entryPrice: Number(fill.avgPrice),
                    amountUsdc: Number(fill.amountUsdc),
                    shares: Number(fill.shares),
                  })
                }
              />
            </div>
          ) : null}
          {posted ? <p className="text-sm text-yes">Posted. Your reason shows with your bet.</p> : null}
        </>
      ) : posted ? (
        <p className="text-sm text-yes">Free pick posted. Switch to Real bet any time to make it count.</p>
      ) : (
        <PaperCall initialSide={initialSide} yesPrice={yesPrice} noPrice={noPrice} onPost={(side, thesis) => postCall({ side, thesis })} />
      )}
    </div>
  );
}

function PaperCall({
  initialSide,
  yesPrice,
  noPrice,
  onPost,
}: {
  initialSide: Side;
  yesPrice: string | null;
  noPrice: string | null;
  onPost: (side: Side, thesis: string) => Promise<void>;
}) {
  const [side, setSide] = useState<Side>(initialSide);
  return (
    <div className="space-y-3">
      <p className="text-xs text-paper-dim">
        No money needed. Your pick is saved at today&apos;s odds and shown as a <strong className="text-paper">free pick</strong>. Only real bets count toward your record.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["yes", "no"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${side === s ? (s === "yes" ? "border-yes bg-yes-bg text-yes" : "border-no bg-no-bg text-no") : "border-line text-paper-dim"}`}
          >
            {s.toUpperCase()} {(s === "yes" ? yesPrice : noPrice) ? (1 / Number(s === "yes" ? yesPrice : noPrice)).toFixed(2) : ""}
          </button>
        ))}
      </div>
      <ThesisForm label="Why this side?" placeholder="Your reason. It's public and time-stamped." submitLabel="Post free pick" required onSubmit={(t) => onPost(side, t)} />
    </div>
  );
}
