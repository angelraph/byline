"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import type { PantaInstruction } from "@/lib/panta/schemas";
import { compileInstructions, sendAndConfirm, TxError } from "./tx";

/** Compile Panta instructions, have the connected wallet sign, broadcast, and confirm. */
export function useSendInstructions() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  return useCallback(
    async (build: { instructions: PantaInstruction[]; recentBlockhash: string; lastValidBlockHeight: number }) => {
      if (!publicKey || !signTransaction) throw new TxError("send", "Connect a wallet first.");
      const tx = compileInstructions(build.instructions, publicKey, build.recentBlockhash);
      const signed = await signTransaction(tx);
      return sendAndConfirm(connection, signed, build.lastValidBlockHeight);
    },
    [connection, publicKey, signTransaction],
  );
}
