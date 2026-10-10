"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { shortAddr } from "@/lib/format";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { publicKey, connecting, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : compact ? "Connect" : "Connect wallet"}
      </button>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-ink-2 px-3 py-2 font-mono text-sm text-paper transition hover:border-paper-mute"
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="h-4 w-4" />
        ) : null}
        {shortAddr(addr)}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-ink-2 text-sm shadow-xl">
          <Link href={`/u/${addr}`} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-ink-3">
            My byline
          </Link>
          <Link href="/portfolio" onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-ink-3">
            Book
          </Link>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(addr).catch(() => undefined);
              setOpen(false);
            }}
            className="block w-full px-4 py-3 text-left hover:bg-ink-3"
          >
            Copy address
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              disconnect().catch(() => undefined);
            }}
            className="block w-full border-t border-line px-4 py-3 text-left text-no hover:bg-ink-3"
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
