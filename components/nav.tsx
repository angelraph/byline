"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { WalletButton } from "./wallet-button";
import { Logo } from "./brand";

const SECTIONS = [
  { href: "/", label: "Home", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/slate", label: "Sports", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zm-7 7l4 2m10-2l-4 2m-3 0v5" },
  { href: "/wire", label: "Markets", icon: "M3 17l5-6 4 4 8-9" },
  { href: "/desks", label: "Desks", icon: "M4 20v-8l8-6 8 6v8M9 20v-5h6v5" },
  { href: "/leaderboard", label: "Leaderboard", icon: "M8 21h8M12 17v4M6 4h12v5a6 6 0 01-12 0z" },
  { href: "/brief", label: "AI Brief", icon: "M4 6h16M4 12h10M4 18h7" },
  { href: "/forge", label: "Create", icon: "M12 5v14M5 12h14" },
  { href: "/docs", label: "How it works", icon: "M12 17h.01M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 21a9 9 0 100-18 9 9 0 000 18z" },
] as const;

const MOBILE = [
  SECTIONS[0],
  SECTIONS[1],
  SECTIONS[2],
  SECTIONS[6],
  { href: "/portfolio", label: "Book", icon: "M6 4h10a2 2 0 012 2v14l-7-3-7 3V6a2 2 0 012-2z" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [q, setQ] = useState(pathname === "/wire" ? (params.get("q") ?? "") : "");
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/wire?f=all&q=${encodeURIComponent(term)}` : "/wire");
      }}
    >
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-mute" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search markets, teams, topics"
        aria-label="Search markets"
        className="h-10 w-full rounded-xl border border-line bg-ink-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-paper-mute focus:border-accent focus:bg-ink"
      />
    </form>
  );
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex h-8 shrink-0 items-center" aria-label="BYLINE home">
          <Logo variant="mark" className="h-8 sm:hidden" />
          <Logo variant="wordmark" className="hidden h-6 sm:block" />
        </Link>
        <Suspense fallback={<div className="hidden h-10 max-w-xl flex-1 md:block" />}>
          <SearchBox className="hidden max-w-xl flex-1 md:block" />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/portfolio" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-paper-dim hover:text-paper md:inline">
            Book
          </Link>
          <Link
            href="/forge"
            className="hidden rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-paper transition hover:border-accent lg:inline"
          >
            Create market
          </Link>
          <WalletButton compact />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4">
        <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto" aria-label="Sections">
          {SECTIONS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition ${
                  active ? "border-accent text-paper" : "border-transparent text-paper-dim hover:text-paper"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-line/60 px-4 py-2 md:hidden">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBox />
        </Suspense>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {MOBILE.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${active ? "text-accent" : "text-paper-mute"}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
