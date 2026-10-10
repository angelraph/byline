import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_ITEMS, FaqList } from "@/components/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How BYLINE works: wallets, trading on Panta, scoring, creating markets, and safety.",
};

const GROUPS = ["Basics", "Trading", "Records", "Creators", "Safety"] as const;

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-6">
      <header className="animate-fade-up text-center">
        <p className="text-sm font-semibold text-accent">Help center</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Frequently asked questions</h1>
        <p className="mx-auto mt-3 max-w-xl text-paper-dim">
          Everything about calls, receipts and records. Want the detail? <Link href="/docs" className="font-semibold text-accent hover:underline">Read the docs</Link>.
        </p>
      </header>
      <nav className="no-scrollbar flex justify-center gap-2 overflow-x-auto" aria-label="FAQ sections">
        {GROUPS.map((g) => (
          <a key={g} href={`#${g.toLowerCase()}`} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:border-accent hover:text-paper">
            {g}
          </a>
        ))}
      </nav>
      {GROUPS.map((g) => (
        <section key={g} id={g.toLowerCase()} className="scroll-mt-24">
          <h2 className="mb-3 font-display text-xl font-semibold">{g}</h2>
          <FaqList items={FAQ_ITEMS.filter((i) => i.group === g)} />
        </section>
      ))}
      <div className="card p-6 text-center">
        <p className="font-display text-lg font-semibold">Still stuck?</p>
        <p className="mt-1 text-sm text-paper-dim">
          Open an issue on{" "}
          <a href="https://github.com/angelraph/byline/issues" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">GitHub</a>{" "}
          or ask in the{" "}
          <a href="https://discord.gg/M76nH6fUwc" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">Panta Discord</a>.
        </p>
      </div>
    </div>
  );
}
