import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import type { PantaInstruction } from "@/lib/panta/schemas";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Compile Panta's instruction list into an unsigned v0 transaction paid by `payer`. */
export function compileInstructions(
  instructions: PantaInstruction[],
  payer: PublicKey,
  recentBlockhash: string,
): VersionedTransaction {
  const ixs = instructions.map(
    (ix) =>
      new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        data: Buffer.from(base64ToBytes(ix.data)),
        keys: ix.accounts.map((a) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        })),
      }),
  );
  const message = new TransactionMessage({ payerKey: payer, recentBlockhash, instructions: ixs }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Decode a base64 unsigned VersionedTransaction (market creation). */
export function decodeTransaction(b64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(base64ToBytes(b64));
}

export class TxError extends Error {
  constructor(
    public readonly kind: "rejected" | "expired" | "failed" | "send",
    message: string,
  ) {
    super(message);
    this.name = "TxError";
  }
}

/** Map wallet / RPC failures to a kind the UI can explain. */
export function classifyTxError(err: unknown): TxError {
  if (err instanceof TxError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/reject|denied|cancel|declined/i.test(msg)) return new TxError("rejected", "You declined the transaction in your wallet.");
  if (/blockhash|expired|block height exceeded/i.test(msg)) return new TxError("expired", "The transaction expired before it landed. Try again.");
  if (/insufficient|0x1\b|debit an account/i.test(msg)) return new TxError("failed", "Not enough USDC or SOL in this wallet to cover the trade and network fee.");
  return new TxError("send", msg.length > 160 ? `${msg.slice(0, 157)}…` : msg);
}

/**
 * Send a signed transaction and wait for confirmation, rebroadcasting until the blockhash
 * expires. Returns the signature once confirmed.
 */
export async function sendAndConfirm(
  connection: Connection,
  signed: VersionedTransaction,
  lastValidBlockHeight: number,
): Promise<string> {
  const raw = signed.serialize();
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 2 });
  const blockhash = signed.message.recentBlockhash;

  let done = false;
  const rebroadcast = (async () => {
    while (!done) {
      await new Promise((r) => setTimeout(r, 2000));
      if (done) break;
      connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => undefined);
    }
  })();

  try {
    const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) throw new TxError("failed", "The transaction failed on-chain.");
    return signature;
  } catch (err) {
    throw classifyTxError(err);
  } finally {
    done = true;
    await rebroadcast;
  }
}
