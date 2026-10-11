import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode; group: "Basics" | "Trading" | "Records" | "Creators" | "Safety" };

export const FAQ_ITEMS: FaqItem[] = [
  {
    group: "Basics",
    q: "What is BYLINE?",
    a: "BYLINE is a prediction app where every call is backed by a real position on Panta, a prediction-market protocol on Solana. Your public byline shows your record, hit rate and edge, computed from the chain, so nobody can fake it.",
  },
  {
    group: "Basics",
    q: "Do I need an account?",
    a: "No sign-up. Connect a Solana wallet such as Phantom, Solflare or Backpack. Your wallet address is your identity, and your byline lives at /u/your-address.",
  },
  {
    group: "Trading",
    q: "What do I need to make a call?",
    a: "A Solana wallet with some USDC for the position and a little SOL (around 0.01) for network fees. Pick a market, choose YES or NO, enter an amount, and approve in your wallet.",
  },
  {
    group: "Trading",
    q: "How are prices set?",
    a: "Prices are per share and show the market's chance: 62¢ means a 62% chance, which is about 1.61 in decimal odds (1 ÷ 0.62). Each share pays out if your side wins, so $1 at 50¢ buys about 2 shares and returns up to about $2. Before you sign, the panel shows what you get back if you win, what you lose if you don't, the shares, the average price and the fee. Winners are paid from the market's pool, so the payout can be slightly under $1 per share.",
  },
  {
    group: "Trading",
    q: "Can I sell before the market resolves?",
    a: "Not through BYLINE. Panta's API supports buying primary positions, so a call is held to resolution. That's what makes it a receipt: you can't quietly exit a bad call. To change your view, bet on the other side.",
  },
  {
    group: "Trading",
    q: "How do I get paid when I win?",
    a: "When a market resolves in your favour, open My bets and press Claim winnings. The payout goes straight to your wallet.",
  },
  {
    group: "Records",
    q: "How is my byline scored?",
    a: (
      <>
        Record and hit rate count resolved calls. <strong>Edge</strong> is your hit rate minus the average price you paid, so winning
        heavy favourites doesn&apos;t inflate it. ROI uses the actual payout you received. Markets where you hold both sides are excluded. Full
        method in the docs.
      </>
    ),
  },
  {
    group: "Records",
    q: "Why can't anyone fake a record?",
    a: "Positions, outcomes and payouts are read from Panta and Solana, not typed into BYLINE. A call exists only if a signed transaction exists.",
  },
  {
    group: "Creators",
    q: "Can I create my own market?",
    a: "Yes. Open Create market (or Forge this market on any game), write a clear YES/NO question and resolution rule, pay Panta's creation fee, and sign once. It goes live for anyone to trade.",
  },
  {
    group: "Creators",
    q: "Do creators earn anything?",
    a: "Yes. Panta accrues creator fees on trading. Once your market has enough betting, claim them from the Markets you created section of My bets.",
  },
  {
    group: "Safety",
    q: "Does BYLINE hold my money?",
    a: "Never. BYLINE is non-custodial: transactions are built by Panta, signed by your wallet, and settled on Solana. BYLINE never sees your keys or holds funds.",
  },
  {
    group: "Safety",
    q: "Is this financial advice?",
    a: "No. Prediction markets are risky and you can lose your whole stake. AI Briefs summarise market data; they aren't recommendations. Only risk what you can afford to lose, and check local laws.",
  },
];

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink-2">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left font-medium transition hover:bg-ink-3">
            {item.q}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-3 text-paper-dim transition group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-paper-dim">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
