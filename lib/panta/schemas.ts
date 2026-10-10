import { z } from "zod";

/** Panta returns some numeric fields as either strings or numbers. Normalise to string. */
const numStr = z.union([z.string(), z.number()]).transform((v) => String(v));
const nullableNumStr = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined ? null : String(v)));

export const phaseSchema = z.enum(["primary", "secondary", "resolved", "cancelled"]);
export type Phase = z.infer<typeof phaseSchema>;

export const sideSchema = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(z.enum(["yes", "no"]));
export type Side = z.infer<typeof sideSchema>;

export const marketSchema = z.object({
  marketId: z.string(),
  category: z.string().nullable().optional().transform((v) => v ?? "other"),
  title: z.string(),
  description: z.string().nullable().optional().transform((v) => v ?? ""),
  images: z.array(z.string()).nullable().optional().transform((v) => v ?? []),
  phase: phaseSchema,
  marketType: z.string().nullable().optional().transform((v) => v ?? "standard"),
  startTime: z.number().nullable().optional().transform((v) => v ?? null),
  endTime: z.number().nullable().optional().transform((v) => v ?? null),
  resolutionTime: z.number().nullable().optional().transform((v) => v ?? null),
  region: z.string().nullable().optional().transform((v) => v ?? "Global"),
  resolved: z.boolean().nullable().optional().transform((v) => v ?? false),
  status: z.string().nullable().optional().transform((v) => v ?? ""),
  volumeUsdc: nullableNumStr,
  campaignId: z.string().nullable().optional().transform((v) => v ?? null),
  createdByPartner: z.boolean().nullable().optional().transform((v) => v ?? false),
  yesPrice: nullableNumStr,
  noPrice: nullableNumStr,
  primaryYesPrice: nullableNumStr,
  primaryNoPrice: nullableNumStr,
  secondaryYesPrice: nullableNumStr,
  secondaryNoPrice: nullableNumStr,
  // Detail-only fields observed on the live API (not in the docs).
  creatorAddress: z.string().nullable().optional().transform((v) => v ?? null),
  oracle: z.string().nullable().optional().transform((v) => v ?? null),
  isGraduated: z.boolean().nullable().optional().transform((v) => v ?? false),
  tradingFeeAccrued: nullableNumStr,
  creatorTwitterHandle: z.string().nullable().optional().transform((v) => v ?? null),
  totalVolumeUsdc: nullableNumStr,
});
export type Market = z.infer<typeof marketSchema>;

export const marketListSchema = z.object({
  items: z.array(marketSchema),
  nextCursor: z.string().nullable().optional().transform((v) => v ?? null),
});
export type MarketList = z.infer<typeof marketListSchema>;

export const categoriesSchema = z.object({ categories: z.array(z.string()) });

export const tradeSchema = z.object({
  id: numStr,
  marketId: z.string(),
  wallet: z.string(),
  isPrimary: z.boolean().nullable().optional().transform((v) => v ?? true),
  yesAmount: numStr,
  noAmount: numStr,
  feePaid: nullableNumStr,
  blockTime: z.number().nullable().optional().transform((v) => v ?? null),
  signature: z.string(),
  quoteAsset: z.string().nullable().optional().transform((v) => v ?? "USDC"),
  // Live API extras: kind/side/shares are human-readable; amountUsdc is often null.
  kind: z.string().nullable().optional().transform((v) => v ?? "buy"),
  side: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .pipe(z.enum(["yes", "no"]).nullable()),
  shares: nullableNumStr,
  amountUsdc: nullableNumStr,
});
export type Trade = z.infer<typeof tradeSchema>;

export const marketTradesSchema = z.object({
  marketId: z.string().optional(),
  items: z.array(tradeSchema),
});
export const walletTradesSchema = z.object({
  wallet: z.string().optional(),
  items: z.array(tradeSchema),
});

export const instructionSchema = z.object({
  programId: z.string(),
  data: z.string(),
  accounts: z.array(
    z.object({ pubkey: z.string(), isSigner: z.boolean(), isWritable: z.boolean() }),
  ),
});
export type PantaInstruction = z.infer<typeof instructionSchema>;

export const orderQuoteSchema = z.object({
  quoteId: z.string(),
  marketId: z.string(),
  side: sideSchema,
  amountUsdc: numStr,
  shares: numStr,
  avgPrice: numStr,
  feeUsdc: numStr,
  expiresAt: z.string(),
  blockhashExpiryHintSec: z.number().optional(),
});
export type OrderQuote = z.infer<typeof orderQuoteSchema>;

export const orderBuildSchema = z.object({
  orderId: z.string(),
  quoteId: z.string(),
  wallet: z.string(),
  marketId: z.string(),
  side: sideSchema,
  amountUsdc: numStr,
  expectedShares: numStr,
  feeUsdc: numStr,
  status: z.string(),
  instructions: z.array(instructionSchema),
  recentBlockhash: z.string(),
  lastValidBlockHeight: z.number(),
  expiresAt: z.string(),
});
export type OrderBuild = z.infer<typeof orderBuildSchema>;

export const orderStatusSchema = z.enum(["built", "submitted", "confirmed", "failed", "expired"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSubmitSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  signature: z.string().nullable().optional(),
});

export const orderVerifySchema = z.object({
  orderId: z.string(),
  status: orderStatusSchema,
  signature: z.string().nullable().optional().transform((v) => v ?? null),
  marketId: z.string().optional(),
  side: sideSchema.optional(),
  amountUsdc: nullableNumStr,
});
export type OrderVerify = z.infer<typeof orderVerifySchema>;

export const positionSchema = z.object({
  marketId: z.string(),
  category: z.string().nullable().optional().transform((v) => v ?? null),
  side: sideSchema,
  shares: numStr,
  phase: phaseSchema,
  claimable: z.boolean(),
  claimed: z.boolean(),
  outcome: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .pipe(z.enum(["yes", "no"]).nullable()),
  // Live API extras.
  title: z.string().nullable().optional().transform((v) => v ?? null),
  images: z.array(z.string()).nullable().optional().transform((v) => v ?? []),
  price: nullableNumStr,
  priceSource: z.string().nullable().optional().transform((v) => v ?? null),
  currentValueUsdc: nullableNumStr,
  availableShares: nullableNumStr,
  /** Cost basis: USDC this wallet put into the market's primary curve on this side. */
  marketPrimaryContributedUsdc: nullableNumStr,
  claimedPayoutUsdc: nullableNumStr,
  claimedAt: z.number().nullable().optional().transform((v) => v ?? null),
});
export type Position = z.infer<typeof positionSchema>;
export const positionsSchema = z.object({
  wallet: z.string(),
  positions: z.array(positionSchema),
});

export const claimBuildSchema = z.object({
  wallet: z.string(),
  marketId: z.string(),
  outcome: z.string(),
  winningShares: numStr,
  instructions: z.array(instructionSchema),
  recentBlockhash: z.string(),
  lastValidBlockHeight: z.number(),
});
export type ClaimBuild = z.infer<typeof claimBuildSchema>;

export const creatorFeesBuildSchema = z.object({
  wallet: z.string(),
  marketId: z.string(),
  claimableFeesUsdc: numStr,
  instructions: z.array(instructionSchema),
  recentBlockhash: z.string(),
  lastValidBlockHeight: z.number(),
});
export type CreatorFeesBuild = z.infer<typeof creatorFeesBuildSchema>;

export const createQuoteSchema = z.object({
  createId: z.string(),
  expectedEventPda: z.string(),
  paymentUsdc: numStr,
  liquidityInjectionUsdc: nullableNumStr,
  platformRevenueUsdc: nullableNumStr,
  marketType: z.string().optional(),
  expiresAt: z.string(),
});
export type CreateQuote = z.infer<typeof createQuoteSchema>;

export const createBuildSchema = z.object({
  createId: z.string(),
  expectedEventPda: z.string(),
  transaction: z.string(),
  recentBlockhash: z.string(),
  lastValidBlockHeight: z.number(),
  paymentUsdc: numStr,
  expiresAt: z.string(),
});
export type CreateBuild = z.infer<typeof createBuildSchema>;

export const registerSchema = z.object({
  createId: z.string(),
  marketId: z.string(),
  status: z.string(),
  signature: z.string().optional(),
  category: z.string().optional(),
  title: z.string().optional(),
  images: z.array(z.string()).optional(),
});
export type RegisterResult = z.infer<typeof registerSchema>;

export const imageUploadSchema = z.object({
  uploadUrl: z.string(),
  publicId: z.string(),
  expiresAt: z.string(),
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type ImageUploadTicket = z.infer<typeof imageUploadSchema>;

export const tradeReportSchema = z.object({
  signature: z.string(),
  status: z.string(),
  marketId: z.string().optional(),
  wallet: z.string().optional(),
  side: z.string().nullable().optional(),
  kind: z.string().optional(),
});
export type TradeReport = z.infer<typeof tradeReportSchema>;

export const tradeStatusSchema = z.object({
  signature: z.string(),
  status: z.enum(["processed", "pending_attribution", "unknown", "failed"]),
  marketId: z.string().optional(),
  wallet: z.string().optional(),
});
export type TradeStatus = z.infer<typeof tradeStatusSchema>;

export const accountSchema = z.object({
  userId: z.string(),
  email: z.string().optional(),
  name: z.string().nullable().optional(),
  status: z.string().optional(),
  canCreateMarkets: z.boolean().optional(),
});
export type PantaAccount = z.infer<typeof accountSchema>;

export const errorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  field: z.string().optional(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});
