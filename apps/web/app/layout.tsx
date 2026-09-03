import type { Metadata } from "next";
import Link from "next/link";
import { SimProvider } from "@/lib/sim-context";
import { ErrorToast } from "@/components/ErrorToast";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen bg-ink text-paper font-sans antialiased">
        <SimProvider>
          <header className="border-b border-white/10">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <span className="font-mono text-sm tracking-wide text-white/60">standard-law</span>
              <ul className="flex gap-4 text-sm">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="text-white/70 hover:text-paper">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs leading-relaxed text-white/40">
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
