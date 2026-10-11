"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { apiGet, apiPost, ClientApiError } from "./api";

type Me = { wallet: string | null };

/**
 * Wallet sign-in state for posting. A session is valid only while the connected wallet
 * matches the signed-in one, so switching wallets never posts as the wrong address.
 */
export function useSession() {
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const me = useSWR<Me, Error>("/api/auth", (u: string) => apiGet<Me>(u), { revalidateOnFocus: false });
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = publicKey?.toBase58() ?? null;
  const wallet = me.data?.wallet && me.data.wallet === connected ? me.data.wallet : null;

  const signIn = useCallback(async (): Promise<string | null> => {
    setError(null);
    if (!publicKey) {
      setVisible(true);
      return null;
    }
    if (!signMessage) {
      setError("This wallet can't sign messages. Try Phantom, Solflare or Backpack.");
      return null;
    }
    setSigningIn(true);
    try {
      const addr = publicKey.toBase58();
      const start = await apiPost<{ nonce: string; issuedAt: string; message: string }>("/api/auth", { action: "start", wallet: addr });
      const sig = await signMessage(new TextEncoder().encode(start.message));
      await apiPost<Me>("/api/auth", { action: "finish", wallet: addr, nonce: start.nonce, issuedAt: start.issuedAt, signature: bs58.encode(sig) });
      await me.mutate({ wallet: addr }, { revalidate: false });
      return addr;
    } catch (err) {
      const msg =
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error && /reject|denied|cancel/i.test(err.message)
            ? "Sign-in was cancelled in your wallet."
            : "Sign-in failed. Try again.";
      setError(msg);
      return null;
    } finally {
      setSigningIn(false);
    }
  }, [publicKey, signMessage, setVisible, me]);

  const signOut = useCallback(async () => {
    await apiPost<Me>("/api/auth", { action: "logout" }).catch(() => undefined);
    await me.mutate({ wallet: null }, { revalidate: false });
  }, [me]);

  return { wallet, connected, signIn, signOut, signingIn, error, loading: me.isLoading };
}
