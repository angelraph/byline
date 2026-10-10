import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { Providers } from "@/components/providers";
import { BottomNav, TopNav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

// SITE_URL overrides; on Vercel the production domain is provided automatically.
const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "BYLINE: Your call. On-chain.", template: "%s · BYLINE" },
  description:
    "Make the call, back it on-chain with Panta, and build a prediction track record nobody can fake. Live sports, fan desks, verified bylines.",
  applicationName: "BYLINE",
  openGraph: { siteName: "BYLINE", type: "website", images: ["/brand/byline-logo.png"] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07060d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6fb" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sora.variable} ${jetbrains.variable} min-h-dvh antialiased`}>
        <Providers>
          <TopNav />
          <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:pb-10">{children}</main>
          <Footer />
          <div className="h-16 md:hidden" aria-hidden="true" />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
