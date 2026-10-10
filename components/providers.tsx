"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo, type ReactNode } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  // RPC goes through this site's /api/rpc relay so the provider key stays on the server.
  // Connection needs an absolute URL; the server render never makes RPC calls.
  const endpoint = useMemo(
    () => (typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}/api/rpc`),
    [],
  );
  // Wallets that implement the Wallet Standard (Phantom, Solflare, Backpack, ...) are detected
  // automatically, so no wallet list is bundled.
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
