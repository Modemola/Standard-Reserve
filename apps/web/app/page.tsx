import Link from "next/link";
import { ArrowRight, ArrowUpRight, FlaskConical, Landmark } from "lucide-react";
import { Card } from "@/components/Card";

const LOOPS = [
  {
    title: "Adoption",
    body: "Genesis and Dutch charters mint new bankers; each opens a branch and starts earning.",
  },
  {
    title: "Expansion",
    body: "Net ETH inflow raises the issuance multiplier m, up to mMax, streaming more $STANDARD to live branches.",
  },
  {
    title: "Fee flow",
    body: "Trading and auction ETH splits 70/15/15 into the active vault, protocol-owned liquidity, and the team.",
  },
  {
    title: "Policy",
    body: "Outflow cuts m immediately; the resolution fee curve and dormancy revocation keep the ledger honest.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="space-y-7 pt-6 text-center sm:pt-10">
        <a
          href="https://www.standardreserve.xyz/whitepaper/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-surface px-4 py-1.5 text-xs text-white/55 shadow-card transition-colors duration-150 hover:border-white/20 hover:text-paper"
        >
          Modeling The Standard Reserve&rsquo;s whitepaper
          <span className="inline-flex items-center gap-0.5 text-expansion">
            read it <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </a>

        <h1
          className="mx-auto max-w-2xl bg-gradient-to-b from-paper to-paper/55 bg-clip-text font-display text-5xl font-bold tracking-tight text-transparent sm:text-6xl"
        >
          Policy Twin
        </h1>

        <p className="mx-auto max-w-xl text-balance text-white/60">
          An unofficial simulator of The Standard Reserve&rsquo;s onchain central bank —
          deterministic, local-first, and built to make the monetary policy legible before you
          touch mainnet.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-lg border border-expansion/40 bg-expansion/10 px-5 py-2.5 text-sm font-medium text-expansion shadow-glow-expansion transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
          >
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            Open Lab
          </Link>
          <Link
            href="/bank/c-0042"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-surface px-5 py-2.5 text-sm text-white/80 shadow-card transition-transform duration-150 hover:scale-[1.03] hover:text-paper active:scale-[0.98]"
          >
            <Landmark className="h-4 w-4" aria-hidden="true" />
            Enter demo bank #0042
          </Link>
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl">
        <div
          aria-hidden="true"
          className="absolute inset-x-8 -top-6 h-full rounded-[2rem] bg-expansion/10 blur-3xl"
        />
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] shadow-card">
          <img
            src="/hero-preview.png"
            alt="The Banker's Cockpit at /bank/c-0042 — regime badge, branch rack, auction clocks, and the what-if drawer"
            className="w-full"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LOOPS.map((loop) => (
          <Card key={loop.title}>
            <h2 className="mb-1.5 font-display text-sm font-medium tracking-wide text-white/85">
              {loop.title}
            </h2>
            <p className="text-sm leading-relaxed text-white/50">{loop.body}</p>
          </Card>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-center gap-6 pb-4 text-xs text-white/35">
        <Link href="/law" className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-white/65">
          Engine ↔ whitepaper mapping <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-white/65"
        >
          Play a bundled scenario <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
