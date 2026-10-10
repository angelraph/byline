"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { ReactNode } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export function Providers({ children }: { children: ReactNode }) {
  // Wallets that implement the Wallet Standard (Phantom, Solflare, Backpack, ...) are detected
  // automatically, so no wallet list is bundled.
  return (
    <ConnectionProvider endpoint={RPC} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
