import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { SimProvider } from "@/lib/sim-context";
import { ErrorToast } from "@/components/ErrorToast";
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

const NAV = [
  { href: "/", label: "Home" },
  { href: "/lab", label: "Lab" },
  { href: "/bank/c-0042", label: "Bank" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/law", label: "Law" },
];

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
            className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,39,0.07),transparent_55%)]"
          />
          <header className="relative border-b border-white/[0.06]">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-display text-sm font-medium tracking-[0.16em] text-paper/90">
                STANDARD·LAW
              </Link>
              <ul className="flex gap-6 text-sm">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className="text-white/55 transition-colors duration-150 hover:text-paper"
                    >
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
          <main className="relative mx-auto max-w-6xl px-4 py-10">{children}</main>
          <footer className="relative mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs leading-relaxed text-white/35">
            <p>
              <em>
                STANDARD is an experimental onchain protocol. This app is unofficial. Not a bank.
                Not investment advice. Not affiliated with The Standard Reserve team unless they
                say otherwise.
              </em>
            </p>
          </footer>
          <ErrorToast />
        </SimProvider>
      </body>
    </html>
  );
}
