"use client";

import Link from "next/link";
import { useState } from "react";
import type { Market } from "@/lib/panta/schemas";
import { apiPost, ClientApiError } from "@/lib/client/api";
import { odds, marketTitle } from "@/lib/format";

type Result = {
  summary: string;
  angles: string[];
  related: Market[];
  draft: { question: string; resolutionRule: string; category: string; resolvesInDays: number };
};

export function HeadlineBrief() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await apiPost<Result>("/api/brief", { text }));
    } catch (err) {
      setResult(null);
      setError(err instanceof ClientApiError ? err.message : "Couldn't write the brief.");
    } finally {
      setLoading(false);
    }
  }

  const forgeHref = result
    ? `/forge?${new URLSearchParams({
        q: result.draft.question,
        rule: result.draft.resolutionRule,
        cat: result.draft.category,
        days: String(result.draft.resolvesInDays),
      }).toString()}`
    : "/forge";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={(e) => void run(e)} className="space-y-3">
        <label htmlFor="headline" className="block text-xs text-paper-mute">Headline or news text</label>
        <textarea
          id="headline"
          rows={8}
          maxLength={4000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a headline, a transfer rumour, a match preview, a policy announcement…"
          className="w-full rounded-2xl border border-line bg-ink-2 p-4 text-sm outline-none focus:border-paper-mute"
        />
        <button
          type="submit"
          disabled={loading || text.trim().length < 15}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Reading the room…" : "Write the brief"}
        </button>
        {error ? <p className="rounded-lg bg-no-bg px-3 py-2 text-sm text-no">{error}</p> : null}
        <p className="text-[11px] text-paper-mute">The AI only restates what you paste and matches it to live Panta markets. It doesn&apos;t browse or invent facts.</p>
      </form>

      <div className="space-y-5">
        {!result ? (
          <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-paper-mute">
            Your scouting report, the Panta markets already pricing it, and a ready-to-forge market appear here.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-line bg-ink-2 p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Brief</p>
              <p className="mt-2">{result.summary}</p>
              {result.angles.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-paper-dim">
                  {result.angles.map((a) => <li key={a}>{a}</li>)}
                </ul>
              ) : null}
            </section>

            <section>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-mute">Already on Panta</p>
              {result.related.length === 0 ? (
                <p className="text-sm text-paper-mute">No open market covers this yet. Be the first.</p>
              ) : (
                <ul className="space-y-2">
                  {result.related.map((m) => (
                    <li key={m.marketId}>
                      <Link href={`/m/${m.marketId}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 p-3 hover:border-line-strong">
                        <span className="line-clamp-1 text-sm">{marketTitle(m)}</span>
                        <span className="shrink-0 font-mono text-xs"><span className="text-yes">{odds(m.yesPrice)}</span> / <span className="text-no">{odds(m.noPrice)}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Draft market</p>
              <p className="mt-2 font-display text-lg leading-snug">{result.draft.question}</p>
              <p className="mt-2 text-xs text-paper-dim">{result.draft.resolutionRule}</p>
              <Link href={forgeHref} className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
                Open in Forge →
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
