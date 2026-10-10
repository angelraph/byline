import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { Providers } from "@/components/providers";
import { BottomNav, TopNav } from "@/components/nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Byline: calls with receipts", template: "%s · Byline" },
  description:
    "Make a call, back it on-chain with Panta, and build a track record nobody can fake. Live sports slate, fan desks, and verified bylines.",
  openGraph: { siteName: "Byline", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable} ${jetbrains.variable} min-h-dvh antialiased`}>
        <Providers>
          <TopNav />
          <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:pb-16">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
