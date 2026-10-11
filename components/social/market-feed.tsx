"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { apiGet, apiPost, ClientApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { relativeTime, shortAddr } from "@/lib/format";
import { CallCard, type CallView } from "./call-card";

type Comment = { id: string; wallet: string; body: string; created_at: string };

/** Calls (with theses) and discussion for one market. */
export function MarketFeed({ marketId }: { marketId: string }) {
  const [tab, setTab] = useState<"calls" | "discussion">("calls");
  const { wallet, signIn, signingIn, error: authError } = useSession();
  const calls = useSWR<{ calls: CallView[] }, Error>(`/api/calls?market=${marketId}`, (u: string) => apiGet(u), { refreshInterval: 20_000 });
  const comments = useSWR<{ comments: Comment[] }, Error>(`/api/comments?market=${marketId}`, (u: string) => apiGet(u), { refreshInterval: 20_000 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callList = calls.data?.calls ?? [];
  const commentList = comments.data?.comments ?? [];
  const yesCalls = callList.filter((c) => c.side === "yes").length;

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const who = wallet ?? (await signIn());
    if (!who) return;
    setBusy(true);
    try {
      await apiPost("/api/comments", { marketId, body: text });
      setText("");
      await comments.mutate();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Calls and discussion">
      <div className="flex items-center justify-between gap-3 border-b border-line">
        <div className="-mb-px flex gap-1">
          {(["calls", "discussion"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 pb-2.5 text-sm font-medium capitalize ${tab === t ? "border-accent text-paper" : "border-transparent text-paper-dim hover:text-paper"}`}
            >
              {t === "calls" ? "Fans' picks" : "Chat"} <span className="text-paper-mute">({t === "calls" ? callList.length : commentList.length})</span>
            </button>
          ))}
        </div>
        {tab === "calls" && callList.length > 0 ? (
          <span className="pb-2 text-xs text-paper-mute">
            <span className="text-yes">{yesCalls} YES</span> · <span className="text-no">{callList.length - yesCalls} NO</span>
          </span>
        ) : null}
      </div>

      {tab === "calls" ? (
        <div className="mt-4 space-y-3">
          {calls.isLoading ? <p className="text-sm text-paper-mute">Loading picks…</p> : null}
          {!calls.isLoading && callList.length === 0 ? (
            <div className="card p-6 text-center text-sm text-paper-dim">
              No picks yet. Be the first: place a bet or a free pick{" "}
              <Link href="#back" className="font-semibold text-accent">here</Link>.
            </div>
          ) : null}
          {callList.map((c) => (
            <CallCard key={c.id} call={c} viewer={wallet} />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <form onSubmit={(e) => void postComment(e)} className="card space-y-2 p-3">
            <textarea
              rows={2}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something about this market"
              aria-label="Comment"
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-paper-mute"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-paper-mute">{text.length}/500</span>
              <button type="submit" disabled={busy || signingIn || !text.trim()} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
                {signingIn ? "Check your wallet…" : busy ? "Posting…" : wallet ? "Post" : "Sign in & post"}
              </button>
            </div>
            {error || authError ? <p className="text-xs text-no">{error ?? authError}</p> : null}
          </form>
          {commentList.length === 0 && !comments.isLoading ? <p className="text-sm text-paper-mute">No comments yet.</p> : null}
          <ul className="space-y-2">
            {commentList.map((c) => (
              <li key={c.id} className="card p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Link href={`/u/${c.wallet}`} className="font-mono font-semibold hover:text-accent">{shortAddr(c.wallet)}</Link>
                  <span className="text-paper-mute">{relativeTime(c.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
