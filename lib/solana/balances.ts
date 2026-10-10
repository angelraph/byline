import { PublicKey, type Connection } from "@solana/web3.js";

export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export type Balances = { usdc: number; sol: number };

export async function getBalances(connection: Connection, owner: PublicKey): Promise<Balances> {
  const [tokens, lamports] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT }),
    connection.getBalance(owner),
  ]);
  let usdc = 0;
  for (const acc of tokens.value) {
    const data: unknown = acc.account.data;
    if (typeof data === "object" && data !== null && "parsed" in data) {
      const parsed = (data as { parsed: { info?: { tokenAmount?: { uiAmount?: number | null } } } }).parsed;
      usdc += parsed.info?.tokenAmount?.uiAmount ?? 0;
    }
  }
  return { usdc, sol: lamports / 1e9 };
}

/** Rough upper bound for a primary buy's network cost, including a possible token-account rent. */
export const MIN_SOL_FOR_TX = 0.003;
