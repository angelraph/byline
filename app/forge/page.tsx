import type { Metadata } from "next";
import Link from "next/link";
import { getFixture } from "@/lib/sports/espn";
import { getCategories } from "@/lib/panta/api";
import { safe } from "@/lib/data/safe";
import { blankDraft, templatesFor, timesFor } from "@/lib/forge/templates";
import { ForgeForm } from "@/components/forge/forge-form";
import { Notice } from "@/components/ui";

export const metadata: Metadata = {
  title: "Forge",
  description: "Turn any real fixture into a Panta prediction market in one signature.",
};
export const dynamic = "force-dynamic";

const FALLBACK_CATEGORIES = ["sports", "crypto", "politics", "entertainment", "finance", "science", "world", "other"];

export default async function ForgePage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; d?: string; q?: string; rule?: string; cat?: string; days?: string }>;
}) {
  const { fixture: fixtureId, d, q, rule, cat, days } = await searchParams;
  const nowSec = Math.floor(Date.now() / 1000);
  const [fixture, cats] = await Promise.all([
    fixtureId ? safe(() => getFixture(fixtureId, d && /^\d{8}$/.test(d) ? d : undefined)) : Promise.resolve(null),
    safe(() => getCategories()),
  ]);
  const f = fixture && fixture.ok ? fixture.data : null;
  const templates = f ? templatesFor(f, nowSec) : [];
  const tradable = f ? timesFor(f, nowSec).tradable : true;
  const categories = cats.ok ? cats.data.categories : FALLBACK_CATEGORIES;
  const label = f && f.home && f.away ? `${f.away.name} at ${f.home.name}` : null;

  // Drafts handed over from Brief arrive as query params.
  const initial = blankDraft(nowSec);
  if (q) initial.question = q.slice(0, 512);
  if (rule) initial.resolutionRule = rule.slice(0, 2048);
  if (cat && categories.includes(cat)) initial.category = cat;
  const dayCount = Number(days);
  if (Number.isFinite(dayCount) && dayCount >= 1 && dayCount <= 365) {
    initial.endTime = initial.startTime + Math.round(dayCount * 86_400);
    initial.resolutionTime = initial.endTime + 2 * 3600;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Forge</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{label ? `Open a market on ${label}` : "Open a market"}</h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Write the question, set the rule, sign once. It goes live on Panta for anyone to trade, and you earn creator fees when it graduates.
        </p>
      </header>
      {fixtureId && !f ? (
        <Notice tone="warn">
          That fixture isn&apos;t in the live feed right now. You can still write the market by hand, or <Link href="/slate" className="underline">pick another game</Link>.
        </Notice>
      ) : null}
      {f && !tradable ? <Notice tone="warn">This game is over or about to end, so a market on it can&apos;t be traded.</Notice> : null}
      <ForgeForm templates={templates} initial={initial} categories={categories} fixtureLabel={label} />
    </div>
  );
}
