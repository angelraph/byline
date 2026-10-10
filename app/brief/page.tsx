import type { Metadata } from "next";
import { HeadlineBrief } from "@/components/brief/headline-brief";
import { isAiConfigured } from "@/lib/ai";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brief",
  description: "Paste a headline. Get the read, the Panta markets already pricing it, and a market to forge.",
};

export default function BriefPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Brief</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">From headline to market</h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Paste the news. Brief tells you what it actually claims, which live markets already price it, and drafts a market you can forge in one signature.
        </p>
      </header>
      {!isAiConfigured() ? <Notice tone="warn">AI briefs are switched off on this server until an OpenAI key is configured.</Notice> : null}
      <HeadlineBrief />
    </div>
  );
}
