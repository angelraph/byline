import Link from "next/link";
import { Logo } from "./brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/slate", label: "Sports slate" },
      { href: "/wire", label: "Markets" },
      { href: "/desks", label: "Fan desks" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/forge", label: "Create a market" },
      { href: "/brief", label: "AI Brief" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs", label: "How it works" },
      { href: "/docs#scoring", label: "How bylines are scored" },
      { href: "/docs#panta", label: "Panta integration" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal", label: "Terms of use" },
      { href: "/legal#risk", label: "Risk disclosure" },
      { href: "/legal#privacy", label: "Privacy" },
    ],
  },
] as const;

const EXTERNAL = [
  { href: "https://github.com/angelraph/byline", label: "GitHub" },
  { href: "https://www.panta.market", label: "Panta" },
  { href: "https://docs.panta.market", label: "Panta API" },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo variant="full" className="block h-12" />
          <p className="mt-4 max-w-xs text-sm text-paper-dim">
            Calls with receipts. Every position is signed by your wallet and settled on Solana through Panta.
          </p>
          <ul className="mt-4 flex gap-4 text-sm">
            {EXTERNAL.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className="text-paper-mute hover:text-paper">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-paper-mute">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-paper-dim transition hover:text-paper">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-paper-mute">
          Prediction markets carry risk of total loss. Byline is non-custodial software and does not provide financial advice. Not available where prohibited.
        </p>
      </div>
    </footer>
  );
}
