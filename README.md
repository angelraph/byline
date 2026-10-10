# Byline: calls with receipts

**Make the call. Put money on it. Keep the receipt.**

Every sports community is full of people who "called it", and nobody can check. Byline turns a call into a receipt: a real YES/NO position on [Panta](https://www.panta.market), signed by your wallet, timestamped on Solana, and settled by the market. Your **byline** is a public track record computed from the chain: record, hit rate, ROI, and **edge** (hit rate minus the odds you actually paid). Winning favourites is easy; beating the price is the skill.

Without Panta, Byline would be another feed of takes. With Panta, "I called it" is verifiable.

Built for the Colosseum Crypto World's Fair · Panta API Sidetrack.

## What's in it

| Surface | What it does |
| - | - |
| **Slate** `/` | Real fixtures (EPL, UCL, LaLiga, NFL, NBA, MLB, NHL, UFC) with live scores. Panta markets are matched to each game; games without one get **Forge this market**. |
| **Market case** `/m/:id` | Live line, AI Brief (YES case / NO case / what to watch), trade tape, rules, creator, and the **Back** panel to buy YES/NO on-chain. |
| **Byline** `/u/:wallet` | Verified record from Panta positions: record, hit rate, edge vs market, ROI on actual payouts, streak, open exposure. Hedged markets are excluded from scoring. |
| **Leaderboard** `/leaderboard` | Scans Panta trade tapes for active wallets, scores each from on-chain positions, ranks by edge. Filter by category. |
| **Wire** `/wire` | Terminal over the whole Panta catalog (open / graduated / resolved, search, sort) plus a live blotter of trades with size flags. |
| **Fan Desks** `/desks` | Rooms per league and topic: that world's games, its markets, and its top verified callers. |
| **Forge** `/forge` | Create a Panta market from any real fixture in one signature: question, rule, ESPN source, times, and image pre-filled. |
| **Brief** `/brief` | Paste a headline. AI restates it, finds the open Panta markets already pricing it, and drafts a market you can open in Forge. |
| **Book** `/portfolio` | Your positions, **claim winnings**, and **claim creator fees** on markets you forged. |
| **Share cards** | Every byline and market renders a live Open Graph card with the real numbers. |

## Panta integration

Every endpoint the API offers is used for real, server-side, with the key never sent to the browser.

| Panta endpoint | Used for | Code |
| - | - | - |
| `GET /markets/` (+ cursor paging, `status`, `createdBy=me`) | Catalog, Slate matching, Wire, Desks, creator-fee discovery | `lib/panta/api.ts` |
| `GET /markets/{id}/` | Live prices, phase, creator, graduation | `getMarket`, `getMarketMerged` |
| `GET /markets/{id}/trades/` | Trade tape, blotter, leaderboard wallet discovery, AI brief inputs | `lib/wire.ts`, `lib/leaderboard.ts` |
| `GET /categories/` | Forge category allowlist | `app/forge/page.tsx` |
| `GET /wallets/{w}/trades/` | Call timing, byline fallback | `app/u/[wallet]/page.tsx` |
| `GET /positions/` | Byline stats, Book, leaderboard scoring, claim eligibility | `lib/stats.ts` |
| `POST /primaryorderquote/` → `/primaryorderbuild/` → `/primaryordersubmit/` → `/primaryorderverify/` | Back YES/NO with live quote, countdown, auto re-quote, slippage | `components/trade/buy-panel.tsx`, `app/api/orders/*` |
| `POST /trades/` | Attribution for buys and win claims | `app/api/orders/confirm`, `app/api/claims/report` |
| `POST /markets/create/quote/` → `/build/` → `/markets/register/` | Forge | `components/forge/forge-form.tsx`, `app/api/forge` |
| `POST /markets/create/image-upload/` | Upload a market image to Cloudinary | `forge-form.tsx` |
| `POST /claim/build/` | Claim winnings | `components/book/book.tsx` |
| `POST /claim/creator-fees/build/` | Claim creator fees on graduated markets | `components/book/book.tsx` |

Custody: Panta returns unsigned transactions or instructions, the user's wallet signs, Byline broadcasts on its RPC and confirms with Panta. Byline never holds funds or keys.

## Built to survive real conditions

Things observed on the live API and handled:

- **Flaky market detail.** `GET /markets/{id}/` sometimes returns an empty title and null prices. Byline retries uncached (with a unique `X-Request-Id` so Next.js doesn't replay the bad response), merges with the catalog row, and falls back to the last complete copy.
- **Positions failures.** `GET /positions/` returns 400 for some wallets and can hang about 50s before a 504. Every request has a timeout; bylines fall back to on-chain trade history with a clear notice; the leaderboard runs a time-boxed scan with a retry pass and reports delayed wallets.
- **Real payout math.** Cost and payout are reported per market, and winning shares don't pay a flat $1, so ROI uses the actual claimed payout. Shares received at no cost don't distort the edge number.
- **Trading edge cases.** Quote expiry countdown with auto re-quote, `QUOTE_STALE` / `QUOTE_EXPIRED` recovery, user-selectable slippage, USDC and SOL balance checks before signing, rebroadcast until the blockhash expires, wallet rejection and failure messages, idempotent confirm and register retries.
- **Phases.** Graduated and closed markets can't be bought. Claims show only when Panta says claimable. Creator fees unlock only after graduation.
- **Sports feed resilience.** ESPN hosts are tried in order (one is blocked on some networks), cached for 2 minutes, and failed leagues are reported rather than hidden.
- **No fake data.** Every number on screen comes from Panta, Solana, or the sports feed. When a source is down, the page says so.

## Run locally

```bash
npm install
node scripts/get-panta-key.mjs   # creates your Panta account + key and writes .env.local
npm run dev
```

Fill the rest of `.env.local` from `.env.example` (Solana RPC, optional OpenAI key, `CRON_SECRET`).

## Deploy (Vercel)

1. Import the repo in Vercel and add the variables from `.env.example`.
2. Optional: set `SITE_URL` to a custom domain (Vercel provides the default domain automatically).
3. Keep caches warm: call `GET /api/cron/warm` every 10 minutes (Vercel Cron on Pro, or any external scheduler such as cron-job.org on Hobby). No credentials needed; it only reads through time-boxed caches.

## Stack

Next.js 15 (App Router, RSC) · TypeScript strict · Tailwind 4 · zod-validated API responses · Solana web3.js + Wallet Adapter (Wallet Standard autodetect) · OpenAI structured outputs · ESPN public scoreboard.
