import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Docs",
  description: "How BYLINE works: calls, trading on Panta, how bylines are scored, creating markets, and the Panta API integration.",
};

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting started" },
  { id: "making-a-call", label: "Making a call" },
  { id: "scoring", label: "How bylines are scored" },
  { id: "creating", label: "Creating markets" },
  { id: "claims", label: "Claims and payouts" },
  { id: "sports", label: "Sports data" },
  { id: "panta", label: "Panta integration" },
  { id: "security", label: "Security model" },
  { id: "fees", label: "Fees and risks" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10 first:border-0 first:pt-0">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-paper-dim [&_strong]:text-paper">{children}</div>
    </section>
  );
}

const ENDPOINTS: [string, string][] = [
  ["GET /markets/, /markets/{id}/, /categories/", "Catalog, live prices, phases, Forge categories"],
  ["GET /markets/{id}/trades/", "Trade tape, Markets blotter, leaderboard discovery, AI Brief inputs"],
  ["GET /wallets/{w}/trades/, /positions/", "Track records, My bets, leaderboard scoring, claim eligibility"],
  ["POST /primaryorderquote/ → build → submit → verify", "Placing bets with a live quote and slippage control"],
  ["POST /markets/create/quote/ → build → /markets/register/", "Create a market (Forge)"],
  ["POST /markets/create/image-upload/", "Market image upload"],
  ["POST /claim/build/, /claim/creator-fees/build/", "Claim winnings, claim creator fees"],
  ["POST /trades/, GET /trades/{sig}/", "Attribution for buys and win claims"],
];

export default function DocsPage() {
  return (
    <div className="grid gap-10 py-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-paper-mute">Documentation</p>
        <nav className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0" aria-label="Docs sections">
          {TOC.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-paper-dim transition hover:bg-ink-2 hover:text-paper">
              {t.label}
            </a>
          ))}
        </nav>
      </aside>

      <article className="max-w-3xl space-y-10">
        <header className="animate-fade-up">
          <p className="text-sm font-semibold text-accent">Docs</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">How BYLINE works</h1>
          <p className="mt-3 text-lg text-paper-dim">Calls with receipts, explained end to end.</p>
        </header>

        <Section id="overview" title="Overview">
          <p>
            BYLINE turns a prediction into a <strong>receipt</strong>. A call is a real YES or NO position on <strong>Panta</strong>, a prediction-market
            protocol on Solana, signed by your wallet and settled by the market. Your <strong>byline</strong> is a public page that scores every call you
            have made, using data read directly from Panta and the chain.
          </p>
          <p>The app is organised around a few surfaces: the Sports slate, Markets, Fan desks, the Leaderboard, Create market, AI Brief, and My bets.</p>
        </Section>

        <Section id="getting-started" title="Getting started">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Install a Solana wallet such as <a className="text-accent hover:underline" href="https://phantom.com/download" target="_blank" rel="noreferrer">Phantom</a>, Solflare or Backpack.</li>
            <li>Fund it with <strong>USDC</strong> (for positions) and about <strong>0.01 SOL</strong> (for network fees) on the Solana network.</li>
            <li>Press <strong>Connect</strong> in the top bar. There&apos;s no sign-up: your wallet address is your identity.</li>
          </ol>
        </Section>

        <Section id="making-a-call" title="Making a call">
          <p>Open any open market and use the <strong>Your bet</strong> panel:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Choose <strong>YES</strong> or <strong>NO</strong> and an amount in USDC.</li>
            <li>BYLINE requests a live quote from Panta: shares, average price, fee and payout. Quotes expire in about 90 seconds and refresh automatically.</li>
            <li>Set your maximum slippage (0.5%, 1% or 3%). If the price moves past it before you sign, you get a fresh quote instead of a worse fill.</li>
            <li>Approve in your wallet. BYLINE broadcasts the transaction, waits for confirmation, and registers it with Panta for attribution.</li>
          </ol>
          <p>
            Panta&apos;s API supports buying primary positions, not selling, so every call is held to resolution. That&apos;s what makes it a receipt: you can&apos;t
            quietly exit a bad call. Taking the other side of someone&apos;s pick is called <strong>Bet against</strong>.
          </p>
        </Section>

        <Section id="scoring" title="How bylines are scored">
          <p>Every number on a byline is derived from your Panta positions:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Record</strong>: wins and losses on resolved markets.</li>
            <li><strong>Hit rate</strong>: wins ÷ resolved calls.</li>
            <li><strong>Edge vs market</strong>: hit rate minus the average entry price you paid. If you bought at 40¢ on average and won 60% of the time, your edge is +20 points. Winning heavy favourites doesn&apos;t inflate it.</li>
            <li><strong>ROI</strong>: (payouts − cost) ÷ cost on resolved calls, using the actual claimed payout. On Panta a winning share doesn&apos;t always pay exactly $1, so BYLINE never assumes it does.</li>
            <li><strong>Streak</strong>: consecutive wins or losses, most recent first.</li>
          </ul>
          <p>
            <strong>Fair-play rules:</strong> markets where a wallet holds both YES and NO are marked <em>hedged</em> and excluded from scoring. Shares received at
            zero cost carry no price signal and are left out of edge. The leaderboard requires at least 3 resolved, unhedged calls.
          </p>
          <p><strong>Divisions</strong> rank bylines by skill and sample size:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Diamond</strong>: 10+ resolved calls and at least +15 points of edge.</li>
            <li><strong>Gold</strong>: 5+ resolved calls and at least +5 points of edge.</li>
            <li><strong>Silver</strong>: 3+ resolved calls and non-negative edge.</li>
            <li><strong>Bronze</strong>: 3+ resolved calls.</li>
            <li><strong>Rookie</strong>: fewer than 3 resolved calls.</li>
          </ul>
        </Section>

        <Section id="creating" title="Creating markets">
          <p>
            Use <Link href="/forge" className="text-accent hover:underline">Create market</Link>, or <strong>Forge this market</strong> on any game in the Sports slate. For real
            fixtures, BYLINE pre-fills the question, a precise resolution rule, the official ESPN match page as source of truth, times based on the
            sport&apos;s typical length, and the team logo as the image.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Standard markets must open at least one hour in the future. Games starting sooner become <strong>breaking</strong> markets that open immediately.</li>
            <li>You pay Panta&apos;s creation fee, part of which seeds the market&apos;s liquidity. The exact amount is shown before you sign.</li>
            <li>Once it has enough betting, the market accrues <strong>creator fees</strong> you can claim from My bets.</li>
          </ul>
        </Section>

        <Section id="claims" title="Claims and payouts">
          <p>
            When a market resolves, your <Link href="/portfolio" className="text-accent hover:underline">My bets</Link> shows positions that are claimable. Press <strong>Claim winnings</strong>,
            approve in your wallet, and the payout lands in your wallet. Creator fees on markets you created are claimed the same way.
          </p>
        </Section>

        <Section id="sports" title="Sports data">
          <p>
            Fixtures, live scores and results come from ESPN&apos;s public scoreboard for the Premier League, Champions League, LaLiga, NFL, NBA, MLB, NHL and UFC.
            Panta markets are matched to games by team names and aliases (&ldquo;Spurs&rdquo;, &ldquo;Man Utd&rdquo;) plus the market&apos;s trading window. The feed is cached for two
            minutes, and leagues that fail to load are reported, never hidden.
          </p>
        </Section>

        <Section id="panta" title="Panta integration">
          <p>BYLINE uses the full Panta API, server-side, with the API key never sent to the browser:</p>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <tbody>
                {ENDPOINTS.map(([ep, use]) => (
                  <tr key={ep} className="border-b border-line last:border-0">
                    <td className="bg-ink-2 px-4 py-3 align-top font-mono text-xs text-paper">{ep}</td>
                    <td className="px-4 py-3 align-top">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Resilience: market detail responses that arrive incomplete are retried and merged with the last complete copy. Positions requests have timeouts with a
            trade-history fallback. Every request is validated against a schema, so malformed data never reaches the screen. Source code:{" "}
            <a href="https://github.com/angelraph/byline" target="_blank" rel="noreferrer" className="text-accent hover:underline">github.com/angelraph/byline</a>.
          </p>
        </Section>

        <Section id="security" title="Security model">
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Non-custodial.</strong> Panta returns unsigned transactions; your wallet signs; BYLINE never sees private keys or holds funds.</li>
            <li><strong>Server-side secrets.</strong> The Panta key and the Solana RPC key stay on the server. The browser reaches Solana through a relay that only forwards the specific requests the app needs.</li>
            <li><strong>Validated inputs.</strong> Every API route validates its input, and every on-chain step shows exactly what you&apos;re signing first.</li>
          </ul>
        </Section>

        <Section id="fees" title="Fees and risks">
          <p>
            BYLINE adds no fees of its own. Panta charges a protocol fee on trades (shown in every quote) and a creation fee for new markets. Solana network fees are
            paid in SOL.
          </p>
          <p>
            Prediction markets are risky: you can lose your entire stake, outcomes depend on the market&apos;s resolution source, and on-chain transactions can&apos;t be reversed.
            Read the <Link href="/legal#risk" className="text-accent hover:underline">risk disclosure</Link> before trading.
          </p>
        </Section>
      </article>
    </div>
  );
}
