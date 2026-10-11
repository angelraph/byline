import { ImageResponse } from "next/og";
import { getMarketMerged } from "@/lib/panta/api";
import { odds, marketTitle, num } from "@/lib/format";

export const alt = "Market on Byline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 60;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "Make the call on Byline";
  let yes: number | null = null;
  let no: number | null = null;
  let category = "";
  try {
    const m = await getMarketMerged(id);
    title = marketTitle(m);
    yes = num(m.yesPrice);
    no = num(m.noPrice);
    category = m.category.replace(/-/g, " ").toUpperCase();
  } catch {
    // Render the generic card if Panta is unavailable.
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0d0c", color: "#ece9e1", padding: 72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 48, fontWeight: 700 }}>Byline</span>
          <span style={{ fontSize: 22, color: "#f2b544", letterSpacing: 4 }}>{category || "PANTA MARKET"}</span>
        </div>
        <span style={{ fontSize: title.length > 70 ? 56 : 70, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{title}</span>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 20, padding: 28, background: "rgba(61,220,151,0.12)", border: "2px solid #3ddc97" }}>
            <span style={{ fontSize: 24, color: "#3ddc97", letterSpacing: 3 }}>YES</span>
            <span style={{ fontSize: 72, fontWeight: 700, color: "#3ddc97", fontFamily: "monospace" }}>{odds(yes)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 20, padding: 28, background: "rgba(255,107,94,0.12)", border: "2px solid #ff6b5e" }}>
            <span style={{ fontSize: 24, color: "#ff6b5e", letterSpacing: 3 }}>NO</span>
            <span style={{ fontSize: 72, fontWeight: 700, color: "#ff6b5e", fontFamily: "monospace" }}>{odds(no)}</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
