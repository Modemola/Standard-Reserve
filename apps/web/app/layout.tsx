import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SimProvider } from "@/lib/sim-context";
import { ErrorToast } from "@/components/ErrorToast";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Policy Twin — The Standard Reserve",
  description: "An unofficial simulator of The Standard Reserve's onchain monetary policy.",
};

/** Paper grain — keeps the near-black from reading as flat plastic. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-ink font-sans text-paper antialiased">
        <SimProvider>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,39,0.07),transparent_55%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
            style={{ backgroundImage: GRAIN }}
          />
          <div className="relative z-10">
            <SiteNav />
            <Ticker />
            <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
            <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs leading-relaxed text-white/35">
              <p>
                <em>
                  STANDARD is an experimental onchain protocol. This app is unofficial. Not a bank.
                  Not investment advice. Not affiliated with The Standard Reserve team unless they
                  say otherwise.
                </em>
              </p>
            </footer>
          </div>
          <ErrorToast />
        </SimProvider>
      </body>
    </html>
  );
}
