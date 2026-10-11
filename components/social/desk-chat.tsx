"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, ClientApiError } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { relativeTime, shortAddr } from "@/lib/format";

type Message = { id: number; wallet: string; body: string; created_at: string };

/** Desk room chat. Polls for new messages every few seconds while the tab is visible. */
export function DeskChat({ desk }: { desk: string }) {
  const { wallet, signIn, signingIn, error: authError } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await apiGet<{ messages: Message[] }>(`/api/desks/${desk}/messages?after=${lastId.current}`);
        if (!alive || res.messages.length === 0) return;
        lastId.current = res.messages[res.messages.length - 1].id;
        setMessages((m) => [...m, ...res.messages].slice(-200));
      } catch {
        // Transient; next poll retries.
      } finally {
        if (alive) setLoaded(true);
      }
    }
    void poll();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [desk]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!wallet) {
      const who = await signIn();
      if (!who || !text.trim()) return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ message: Message }>(`/api/desks/${desk}/messages`, { body: text });
      setText("");
      if (res.message.id > lastId.current) {
        lastId.current = res.message.id;
        setMessages((m) => [...m, res.message].slice(-200));
      }
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[420px] flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">Desk chat</p>
        <span className="inline-flex items-center gap-1.5 text-xs text-paper-mute">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-yes" aria-hidden="true" /> Live
        </span>
      </div>
      <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {!loaded ? <li className="text-sm text-paper-mute">Loading…</li> : null}
        {loaded && messages.length === 0 ? <li className="text-sm text-paper-mute">No messages yet. Start the room.</li> : null}
        {messages.map((m) => (
          <li key={m.id} className="text-sm">
            <span className="flex items-center gap-2 text-xs">
              <Link href={`/u/${m.wallet}`} className={`font-mono font-semibold hover:text-accent ${m.wallet === wallet ? "text-accent" : ""}`}>
                {shortAddr(m.wallet)}
              </Link>
              <span className="text-paper-mute">{relativeTime(m.created_at)}</span>
            </span>
            <span className="mt-0.5 block whitespace-pre-line break-words">{m.body}</span>
          </li>
        ))}
      </ol>
      <form onSubmit={(e) => void send(e)} className="border-t border-line p-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={400}
            placeholder={wallet ? "Say something to the room" : "Sign in with your wallet to chat"}
            aria-label="Message"
            className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || signingIn || (Boolean(wallet) && !text.trim())} className="shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
            {signingIn ? "…" : wallet ? "Send" : "Sign in"}
          </button>
        </div>
        {error || authError ? <p className="mt-1 text-xs text-no">{error ?? authError}</p> : null}
      </form>
    </div>
  );
}
