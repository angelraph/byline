import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & risk",
  description: "Terms of use, risk disclosure and privacy for BYLINE.",
};

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 py-6 leading-relaxed text-paper-dim [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-paper [&_strong]:text-paper">
      <header>
        <p className="text-sm font-semibold text-accent">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-paper">Terms, risk and privacy</h1>
        <p className="mt-2 text-sm">Plain-language terms for using BYLINE.</p>
      </header>

      <section id="terms" className="scroll-mt-24 space-y-3">
        <h2>Terms of use</h2>
        <p>
          BYLINE is open-source, non-custodial software that helps you discover, create and trade prediction markets on Panta, a third-party protocol on Solana.
          BYLINE doesn&apos;t operate those markets, hold funds, or act as a broker, exchange or counterparty.
        </p>
        <p>
          You&apos;re responsible for your wallet, keys and transactions, and for making sure using prediction markets is lawful where you live. Don&apos;t use BYLINE where it&apos;s
          prohibited, or if you&apos;re under the age of majority. Market outcomes are decided by each market&apos;s stated resolution rule and source; BYLINE doesn&apos;t resolve
          markets. The software is provided &ldquo;as is&rdquo;, without warranties.
        </p>
      </section>

      <section id="risk" className="scroll-mt-24 space-y-3">
        <h2>Risk disclosure</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>You can lose your entire stake.</strong> Only trade what you can afford to lose.</li>
          <li><strong>No early exit.</strong> Positions bought through BYLINE are held until the market resolves.</li>
          <li><strong>Irreversible transactions.</strong> Signed Solana transactions can&apos;t be undone.</li>
          <li><strong>Resolution risk.</strong> Outcomes depend on the market&apos;s rule and source, which can be ambiguous or delayed.</li>
          <li><strong>Smart-contract and network risk.</strong> Protocol bugs, RPC outages or congestion can affect transactions.</li>
          <li><strong>Not advice.</strong> Prices, bylines and AI Briefs are information, not recommendations.</li>
        </ul>
      </section>

      <section id="privacy" className="scroll-mt-24 space-y-3">
        <h2>Privacy</h2>
        <p>
          BYLINE has no accounts and asks for no personal information. Your wallet address and its on-chain activity are public on Solana by nature; bylines display
          that public data. When you request an AI Brief, the text you paste is sent to an AI provider to produce the summary. Standard hosting logs (such as IP
          addresses) may be kept briefly for security and rate limiting.
        </p>
      </section>
    </article>
  );
}
