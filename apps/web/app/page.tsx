import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FlaskConical, Landmark } from "lucide-react";
import { Card } from "@/components/Card";
import { Guilloche } from "@/components/Guilloche";
import { Motes } from "@/components/Motes";
import { DEMO_CHARTER_ID } from "@/lib/demo-seed";
// Static import (not a "/hero-preview.png" string): this is what lets next
// read the real 2800x1480 up front and generate the blur placeholder.
import heroPreview from "@/public/hero-preview.png";

const LOOPS = [
  {
    index: "01",
    title: "Adoption",
    body: "Genesis and Dutch charters mint new bankers; each opens a branch and starts earning.",
  },
  {
    index: "02",
    title: "Expansion",
    body: "Net ETH inflow raises the issuance multiplier m, up to mMax, streaming more $STANDARD to live branches.",
  },
  {
    index: "03",
    title: "Fee flow",
    body: "Trading and auction ETH splits 70/15/15 into the active vault, protocol-owned liquidity, and the team.",
  },
  {
    index: "04",
    title: "Policy",
    body: "Outflow cuts m immediately; the resolution fee curve and dormancy revocation keep the ledger honest.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      {/* ── Hero ───────────────────────────────────────────────── */}
      {/* overflow-hidden: the rosette is deliberately wider than the column,
          and without this it pushes the page horizontally on small screens. */}
      <section className="relative isolate -mt-4 overflow-hidden pb-4 pt-10 sm:pt-16">
        <Motes className="-z-20 -inset-y-24" />
        <Guilloche className="absolute left-1/2 top-[38%] -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-45 sm:h-[680px] sm:w-[680px]" />
        {/* Scrim: keeps the engraving legible as texture without letting it
            compete with the copy sitting on top of it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_42%,rgba(8,9,11,0.92)_0%,rgba(8,9,11,0.7)_45%,transparent_75%)]"
        />

        <CornerFrame />

        <div className="relative flex flex-col items-center text-center">
          <div
            className="rise flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/30"
            style={{ animationDelay: "80ms" }}
          >
            <Rule />
            monetary physics engine
            <Rule />
          </div>

          {/* Two elements: `rise` and `foil` both set the animation
              shorthand, so they cannot share a node. */}
          <div className="rise mt-6" style={{ animationDelay: "180ms" }}>
            <h1 className="foil optical-display bg-clip-text font-serif text-6xl font-bold leading-[0.92] tracking-tight text-transparent drop-shadow-[0_0_40px_rgba(201,162,39,0.18)] sm:text-7xl lg:text-8xl">
              Policy Twin
            </h1>
          </div>

          <p
            className="rise mt-7 max-w-xl text-balance leading-relaxed text-white/55"
            style={{ animationDelay: "300ms" }}
          >
            An unofficial simulator of The Standard Reserve&rsquo;s onchain central bank —
            deterministic, local-first, and built to make the monetary policy legible before you
            touch mainnet.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "420ms" }}
          >
            <Link
              href="/lab"
              className="group inline-flex items-center gap-2 rounded-lg border border-expansion/40 bg-expansion/10 px-6 py-3 text-sm font-medium text-expansion shadow-glow-expansion transition-all duration-200 hover:bg-expansion/[0.18] hover:shadow-[0_0_0_1px_rgba(201,162,39,0.4),0_0_32px_-4px_rgba(201,162,39,0.5)]"
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Open Lab
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href={`/bank/${DEMO_CHARTER_ID}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-surface px-6 py-3 text-sm text-white/75 shadow-card transition-colors duration-200 hover:border-white/25 hover:text-paper"
            >
              <Landmark className="h-4 w-4" aria-hidden="true" />
              Enter demo bank #{DEMO_CHARTER_ID.replace(/^c-/, "")}
            </Link>
          </div>

          <a
            href="https://www.standardreserve.xyz/whitepaper/"
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-1.5 text-xs text-white/35 transition-colors duration-150 hover:text-white/70"
          >
            Modeling The Standard Reserve&rsquo;s whitepaper
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* ── Product shot ───────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl">
        <div
          aria-hidden="true"
          className="absolute inset-x-10 -top-10 h-40 rounded-full bg-expansion/[0.14] blur-[64px]"
        />
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] shadow-[0_40px_80px_-32px_rgba(0,0,0,0.9)]">
          {/* This shot is the LCP element on the landing page. As a raw
              <img> it shipped 756KB of 2800x1480 PNG with no intrinsic size,
              so it both dominated the load and shifted the page as it
              arrived. next/image serves a width-appropriate WebP/AVIF and
              reserves the box; priority takes it off the lazy path, since
              lazy-loading the thing the viewport is waiting for only delays
              it. sizes caps the request at the container's real 1024px. */}
          <Image
            src={heroPreview}
            alt="The Banker's Cockpit at /bank/c-0042 — regime badge, branch rack, auction clocks, and the what-if drawer"
            className="w-full"
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
            placeholder="blur"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink to-transparent"
          />
        </div>
      </section>

      {/* ── The four loops ─────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="font-sans text-xs uppercase tracking-[0.26em] text-white/40">
            The four loops
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-white/[0.12] to-transparent" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LOOPS.map((loop) => (
            <Card key={loop.title} className="group relative overflow-hidden">
              <span className="tabular absolute right-4 top-3 font-mono text-4xl font-bold text-white/[0.04] transition-colors duration-300 group-hover:text-expansion/[0.14]">
                {loop.index}
              </span>
              <h3 className="mb-1.5 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
                {loop.title}
              </h3>
              <p className="relative text-sm leading-relaxed text-white/50">{loop.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Footer links ───────────────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-center gap-8 border-t border-white/[0.06] pt-8 text-xs text-white/35">
        <Link href="/law" className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-white/70">
          Engine ↔ whitepaper mapping <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-white/70"
        >
          Play a bundled scenario <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function Rule() {
  return <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-transparent via-white/25 to-transparent" />;
}

/** Viewfinder brackets — instrument framing, not decoration. */
function CornerFrame() {
  const corner = "absolute h-5 w-5 border-expansion/25";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 inset-y-0 sm:inset-x-8">
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}
