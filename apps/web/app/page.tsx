import Link from "next/link";

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
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Policy Twin</h1>
        <p className="max-w-2xl text-white/70">
          An unofficial simulator of The Standard Reserve&rsquo;s onchain central bank —
          deterministic, local-first, and built to make the monetary policy legible before you
          touch mainnet.
        </p>
        <div className="flex gap-3">
          <Link
            href="/lab"
            className="rounded border border-expansion/40 bg-expansion/10 px-4 py-2 text-sm text-expansion"
          >
            Open Lab
          </Link>
          <Link
            href="/bank/c-0042"
            className="rounded border border-white/15 px-4 py-2 text-sm text-white/80"
          >
            Enter demo bank #0042
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LOOPS.map((loop) => (
          <div key={loop.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-1 text-sm font-medium text-white/80">{loop.title}</h2>
            <p className="text-sm text-white/50">{loop.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
