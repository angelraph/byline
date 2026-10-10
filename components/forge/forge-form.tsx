"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { CreateBuild, CreateQuote, ImageUploadTicket, RegisterResult } from "@/lib/panta/schemas";
import type { ForgeDraft, ForgeTemplate } from "@/lib/forge/templates";
import { MIN_START_DELAY_SEC } from "@/lib/forge/templates";
import { apiPost, ClientApiError, explainCode } from "@/lib/client/api";
import { classifyTxError, decodeTransaction, sendAndConfirm } from "@/lib/solana/tx";
import { fromBaseUnits, usdc } from "@/lib/format";

type Phase =
  | { kind: "edit" }
  | { kind: "quoting" }
  | { kind: "quoted"; quote: CreateQuote }
  | { kind: "building" }
  | { kind: "signing" }
  | { kind: "sending" }
  | { kind: "registering"; signature: string; createId: string }
  | { kind: "error"; message: string; field?: string; retryRegister?: { signature: string; createId: string } };

function toLocalInput(sec: number): string {
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): number {
  return Math.floor(new Date(v).getTime() / 1000);
}

const inputCls =
  "w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm outline-none transition focus:border-paper-mute";

export function ForgeForm({
  templates,
  initial,
  categories,
  fixtureLabel,
}: {
  templates: ForgeTemplate[];
  initial: ForgeDraft;
  categories: string[];
  fixtureLabel: string | null;
}) {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [draft, setDraft] = useState<ForgeDraft>(templates[0]?.draft ?? initial);
  const [templateKey, setTemplateKey] = useState<string | null>(templates[0]?.key ?? null);
  const [phase, setPhase] = useState<Phase>({ kind: "edit" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = ["quoting", "building", "signing", "sending", "registering"].includes(phase.kind);
  const wallet = publicKey?.toBase58() ?? null;
  const set = <K extends keyof ForgeDraft>(k: K, v: ForgeDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (phase.kind === "quoted" || phase.kind === "error") setPhase({ kind: "edit" });
  };

  const timeProblem = useMemo(() => {
    const now = Date.now() / 1000;
    if (!(draft.startTime < draft.endTime && draft.endTime <= draft.resolutionTime)) return "Times must run open → close → resolve.";
    if (draft.endTime <= now + 300) return "Trading must close at least a few minutes from now.";
    if (!draft.eventInProgress && draft.startTime < now + MIN_START_DELAY_SEC) {
      return "Standard markets must open at least 1 hour from now. Switch to Breaking to open immediately.";
    }
    return null;
  }, [draft]);

  async function uploadImage(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setPhase({ kind: "error", message: "Image must be under 8 MB.", field: "imageUrl" });
      return;
    }
    setUploading(true);
    try {
      const ticket = await apiPost<ImageUploadTicket>("/api/forge", { step: "image" });
      const form = new FormData();
      Object.entries(ticket.fields).forEach(([k, v]) => form.append(k, String(v)));
      form.append("file", file);
      const res = await fetch(ticket.uploadUrl, { method: "POST", body: form });
      const json: unknown = await res.json().catch(() => null);
      const secure = typeof json === "object" && json !== null && "secure_url" in json ? (json as { secure_url: unknown }).secure_url : null;
      if (!res.ok || typeof secure !== "string") throw new Error("Upload failed");
      set("imageUrl", secure);
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof ClientApiError ? explainCode(err.code, err.message) : "Image upload failed. You can paste a public image link instead.",
        field: "imageUrl",
      });
    } finally {
      setUploading(false);
    }
  }

  async function getQuote() {
    if (!wallet) return setVisible(true);
    setPhase({ kind: "quoting" });
    try {
      const quote = await apiPost<CreateQuote>("/api/forge", {
        step: "quote",
        wallet,
        ...draft,
        sourcesOfTruth: draft.sourcesOfTruth.map((s) => s.trim()).filter(Boolean),
        title: draft.title || undefined,
        description: draft.description || undefined,
      });
      setPhase({ kind: "quoted", quote });
    } catch (err) {
      if (err instanceof ClientApiError) {
        setPhase({ kind: "error", message: explainCode(err.code, err.message) });
      } else setPhase({ kind: "error", message: "Couldn't get a fee quote." });
    }
  }

  async function register(createId: string, signature: string) {
    setPhase({ kind: "registering", signature, createId });
    // Panta verifies the confirmed transaction; give its RPC a moment to see it.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const res = await apiPost<RegisterResult>("/api/forge", { step: "register", createId, signature });
        router.push(`/m/${res.marketId}?forged=1`);
        return;
      } catch (err) {
        const code = err instanceof ClientApiError ? err.code : "";
        if (code !== "TX_NOT_FOUND" || attempt === 5) {
          setPhase({
            kind: "error",
            message: err instanceof ClientApiError ? explainCode(code, err.message) : "Registration failed.",
            retryRegister: { signature, createId },
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  async function create() {
    if (phase.kind !== "quoted" || !publicKey || !signTransaction || !wallet) return;
    const { createId } = phase.quote;
    setPhase({ kind: "building" });
    let build: CreateBuild;
    try {
      build = await apiPost<CreateBuild>("/api/forge", { step: "build", createId, wallet });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof ClientApiError ? explainCode(err.code, err.message) : "Couldn't build the transaction." });
      return;
    }
    let signature: string;
    try {
      setPhase({ kind: "signing" });
      const signed = await signTransaction(decodeTransaction(build.transaction));
      setPhase({ kind: "sending" });
      signature = await sendAndConfirm(connection, signed, build.lastValidBlockHeight);
    } catch (err) {
      setPhase({ kind: "error", message: classifyTxError(err).message });
      return;
    }
    await register(createId, signature);
  }

  const fee = phase.kind === "quoted" ? fromBaseUnits(phase.quote.paymentUsdc) : null;
  const liquidity = phase.kind === "quoted" && phase.quote.liquidityInjectionUsdc ? fromBaseUnits(phase.quote.liquidityInjectionUsdc) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {templates.length > 0 ? (
          <div>
            <p className="mb-2 text-xs text-paper-mute">Market type{fixtureLabel ? ` for ${fixtureLabel}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setTemplateKey(t.key);
                    setDraft(t.draft);
                    setPhase({ kind: "edit" });
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm ${templateKey === t.key ? "border-accent bg-accent/10 text-paper" : "border-line text-paper-dim hover:text-paper"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label htmlFor="q" className="mb-1.5 block text-xs text-paper-mute">Question (YES/NO)</label>
            <input id="q" className={inputCls} value={draft.question} maxLength={512} disabled={busy} onChange={(e) => set("question", e.target.value)} placeholder="Will Arsenal beat Leeds United?" />
          </div>
          <div>
            <label htmlFor="rule" className="mb-1.5 block text-xs text-paper-mute">Resolution rule</label>
            <textarea id="rule" rows={4} className={inputCls} value={draft.resolutionRule} maxLength={2048} disabled={busy} onChange={(e) => set("resolutionRule", e.target.value)} placeholder="Resolves YES if… per the official result on…" />
          </div>
          <div>
            <label htmlFor="src" className="mb-1.5 block text-xs text-paper-mute">Source of truth (link)</label>
            <input id="src" className={inputCls} value={draft.sourcesOfTruth[0] ?? ""} disabled={busy} onChange={(e) => set("sourcesOfTruth", [e.target.value])} placeholder="https://www.espn.com/…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cat" className="mb-1.5 block text-xs text-paper-mute">Category</label>
              <select id="cat" className={inputCls} value={draft.category} disabled={busy} onChange={(e) => set("category", e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-paper-mute">Market style</span>
              <div className="grid grid-cols-2 gap-2">
                {(["standard", "breaking"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      set("marketType", t);
                      set("eventInProgress", t === "breaking" && draft.startTime < Date.now() / 1000 + MIN_START_DELAY_SEC);
                    }}
                    className={`rounded-xl border py-2.5 text-sm capitalize ${draft.marketType === t ? "border-accent bg-accent/10" : "border-line text-paper-dim"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["startTime", "Opens"],
                ["endTime", "Trading closes"],
                ["resolutionTime", "Resolves"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label htmlFor={k} className="mb-1.5 block text-xs text-paper-mute">{label}</label>
                <input
                  id={k}
                  type="datetime-local"
                  className={inputCls}
                  disabled={busy || (k === "startTime" && draft.eventInProgress)}
                  value={toLocalInput(draft[k])}
                  onChange={(e) => e.target.value && set(k, fromLocalInput(e.target.value))}
                />
              </div>
            ))}
          </div>
          {draft.eventInProgress ? <p className="text-xs text-accent">Breaking market: opens for trading as soon as it&apos;s created.</p> : null}
          {timeProblem ? <p className="text-sm text-no">{timeProblem}</p> : null}

          <div>
            <label htmlFor="img" className="mb-1.5 block text-xs text-paper-mute">Image</label>
            <div className="flex gap-3">
              {draft.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-ink-3 object-contain p-1" />
              ) : (
                <span className="h-12 w-12 shrink-0 rounded-lg bg-ink-3" aria-hidden="true" />
              )}
              <input id="img" className={inputCls} value={draft.imageUrl} disabled={busy} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://… (square, 1024×1024 ideal)" />
              <button type="button" disabled={busy || uploading} onClick={() => fileRef.current?.click()} className="shrink-0 rounded-xl border border-line px-3 text-sm text-paper-dim hover:text-paper">
                {uploading ? "…" : "Upload"}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0])} />
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-paper-mute">Preview</p>
          <p className="mt-2 font-serif text-xl leading-snug">{draft.question || "Your question appears here"}</p>
          <p className="mt-2 line-clamp-4 text-xs text-paper-dim">{draft.resolutionRule}</p>

          <div className="mt-4 rounded-xl bg-ink p-3 font-mono text-sm tabular">
            {phase.kind === "quoted" && fee !== null ? (
              <dl className="space-y-1.5">
                <div className="flex justify-between"><dt className="text-paper-mute">Creation fee</dt><dd>{usdc(fee)}</dd></div>
                {liquidity !== null ? <div className="flex justify-between"><dt className="text-paper-mute">Seeds liquidity</dt><dd>{usdc(liquidity)}</dd></div> : null}
                <p className="pt-1 text-xs text-paper-mute">You earn creator fees on trading once the market graduates.</p>
              </dl>
            ) : (
              <p className="text-paper-mute">Get a quote to see the creation fee.</p>
            )}
          </div>

          {phase.kind === "error" ? <p className="mt-3 rounded-lg bg-no-bg px-3 py-2 text-sm text-no">{phase.message}</p> : null}

          {!wallet ? (
            <button type="button" onClick={() => setVisible(true)} className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink">
              Connect wallet to forge
            </button>
          ) : phase.kind === "error" && phase.retryRegister ? (
            <button type="button" onClick={() => phase.retryRegister && void register(phase.retryRegister.createId, phase.retryRegister.signature)} className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink">
              Retry registration
            </button>
          ) : phase.kind === "quoted" ? (
            <button type="button" onClick={() => void create()} className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink">
              Create market · {usdc(fee)}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || Boolean(timeProblem) || !draft.question || !draft.resolutionRule || !draft.imageUrl}
              onClick={() => void getQuote()}
              className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase.kind === "quoting"
                ? "Checking with Panta…"
                : phase.kind === "building"
                  ? "Preparing transaction…"
                  : phase.kind === "signing"
                    ? "Approve in your wallet…"
                    : phase.kind === "sending"
                      ? "Creating on Solana…"
                      : phase.kind === "registering"
                        ? "Registering with Panta…"
                        : "Get fee quote"}
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-paper-mute">Created on Panta from your wallet. Byline never holds funds.</p>
        </div>
      </aside>
    </div>
  );
}
