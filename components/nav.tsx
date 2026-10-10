"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./wallet-button";

const PRIMARY = [
  { href: "/", label: "Slate" },
  { href: "/wire", label: "Wire" },
  { href: "/desks", label: "Desks" },
  { href: "/brief", label: "Brief" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/forge", label: "Forge" },
] as const;

const MOBILE = [
  { href: "/", label: "Slate", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/wire", label: "Wire", icon: "M3 17l5-6 4 4 8-9" },
  { href: "/desks", label: "Desks", icon: "M4 20v-8l8-6 8 6v8M9 20v-5h6v5" },
  { href: "/forge", label: "Forge", icon: "M12 5v14M5 12h14" },
  { href: "/portfolio", label: "Book", icon: "M6 4h10a2 2 0 012 2v14l-7-3-7 3V6a2 2 0 012-2z" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="BYLINE home">
          <span className="font-serif text-2xl font-semibold tracking-tight">Byline</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-paper-mute sm:inline">
            on Panta
          </span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Primary">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                isActive(pathname, item.href)
                  ? "bg-ink-3 text-paper"
                  : "text-paper-dim hover:text-paper"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/portfolio"
            className="hidden rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper md:inline"
          >
            Book
          </Link>
          <WalletButton compact />
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {MOBILE.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                  active ? "text-accent" : "text-paper-mute"
                }`}
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
