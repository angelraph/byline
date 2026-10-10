import { ImageResponse } from "next/og";
import { PublicKey } from "@solana/web3.js";
import { getPositions } from "@/lib/panta/api";
import { buildCalls, computeStats } from "@/lib/stats";
import { pct, shortAddr, signedPct } from "@/lib/format";

export const alt = "Byline: verified prediction record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  let valid = true;
  try {
    new PublicKey(wallet);
  } catch {
    valid = false;
  }

  let stats: ReturnType<typeof computeStats> | null = null;
  if (valid) {
    try {
      const p = await getPositions(wallet);
      stats = computeStats(buildCalls(p.positions, []));
    } catch {
      stats = null;
    }
  }

  const cells: { label: string; value: string; color: string }[] = stats
    ? [
        { label: "RECORD", value: stats.resolved ? `${stats.wins}–${stats.losses}` : "—", color: "#ece9e1" },
        { label: "HIT RATE", value: pct(stats.hitRate), color: "#ece9e1" },
        { label: "EDGE", value: signedPct(stats.edge), color: (stats.edge ?? 0) >= 0 ? "#3ddc97" : "#ff6b5e" },
        { label: "ROI", value: signedPct(stats.roi), color: (stats.roi ?? 0) >= 0 ? "#3ddc97" : "#ff6b5e" },
      ]
    : [];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0d0c", color: "#ece9e1", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>Byline</span>
          <span style={{ fontSize: 22, color: "#f2b544", letterSpacing: 4 }}>VERIFIED ON PANTA</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 30, color: "#a9aca5" }}>Track record of</span>
          <span style={{ fontSize: 84, fontWeight: 700, fontFamily: "monospace" }}>{shortAddr(wallet, 6)}</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {cells.length > 0 ? (
            cells.map((c) => (
              <div key={c.label} style={{ display: "flex", flexDirection: "column", flex: 1, border: "2px solid #262d29", borderRadius: 20, padding: 24, background: "#121614" }}>
                <span style={{ fontSize: 20, color: "#6f756f", letterSpacing: 3 }}>{c.label}</span>
                <span style={{ fontSize: 56, fontWeight: 700, color: c.color, fontFamily: "monospace" }}>{c.value}</span>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 32, color: "#a9aca5" }}>Calls backed on-chain. Receipts, not screenshots.</span>
          )}
        </div>
      </div>
    ),
    size,
  );
}
