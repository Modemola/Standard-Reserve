import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Law",
  description:
    "Every formula the engine implements, mapped to the whitepaper section it comes from and the file it lives in.",
};

import {
  LAW_MAPPING,
  LAW_MAPPING_DESK,
  LAW_MAPPING_SENTINEL,
  LAW_MAPPING_SOLIDITY,
} from "@/lib/law-mapping";

export default function LawPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-paper/95">Law</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Every number the engine produces traces back to a whitepaper section here — nothing in
          this simulator is invented. Where the whitepaper leaves a constant unpublished, the
          params drawer in the Lab says so; this table says where the formula that uses it lives.
          See also <code className="font-mono text-white/75">docs/LAW.md</code>.
        </p>
      </div>

      {/* overflow-x-auto, not overflow-hidden. These tables are ~420px wide
          and the phone viewport is 341px of content, so `hidden` did not
          merely crop them -- it made the whole notes column unreachable,
          with no scrollbar and nothing to drag. Clipped content does not
          register as page overflow, which is why the earlier responsive
          sweep reported these tables as fine. */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/20 text-white/45">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Function</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Whitepaper section</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Notes</th>
            </tr>
          </thead>
          <tbody>
            {LAW_MAPPING.map((row) => (
              <tr key={row.engine} className="border-t border-white/[0.05]">
                <td className="px-4 py-2.5 font-mono text-white/85">{row.engine}</td>
                <td className="px-4 py-2.5 text-white/55">{row.wp}</td>
                <td className="px-4 py-2.5 text-white/60">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
          Phase 2 — Sentinel attacks
        </h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45">
          Each fixture in <code className="font-mono text-white/65">attacks/</code> leans on one of
          the rules above. HELD means the rule stopped it; CHEAP means it was allowed and the
          incentive is worth naming. Run them on{" "}
          <code className="font-mono text-white/65">/sentinel</code>, or with{" "}
          <code className="font-mono text-white/65">pnpm sentinel:run</code>.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-white/45">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Attack</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Whitepaper section</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LAW_MAPPING_SENTINEL.map((row) => (
                <tr key={row.engine} className="border-t border-white/[0.05]">
                  <td className="px-4 py-2.5 font-mono text-white/85">{row.engine}</td>
                  <td className="px-4 py-2.5 text-white/55">{row.wp}</td>
                  <td className="px-4 py-2.5 text-white/60">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
          Phase 2 — Open Market Desk quotes
        </h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45">
          The Desk prices only the moves the bank actually has. Every quote is a pure function of a
          cloned world, so reading a price can never change one.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-white/45">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Quote</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Whitepaper section</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LAW_MAPPING_DESK.map((row) => (
                <tr key={row.engine} className="border-t border-white/[0.05]">
                  <td className="px-4 py-2.5 font-mono text-white/85">{row.engine}</td>
                  <td className="px-4 py-2.5 text-white/55">{row.wp}</td>
                  <td className="px-4 py-2.5 text-white/60">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
          Phase E — Solidity twins (audit narrative)
        </h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45">
          <code className="font-mono text-white/65">contracts/law/src/LawMath.sol</code> re-implements
          three of the formulas above in Solidity so an auditor can check the TS engine against an
          independent implementation. It is never deployed. Checked against vectors generated from
          the live engine — see{" "}
          <code className="font-mono text-white/65">contracts/law/test/LawMath.t.sol</code>.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06] bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-white/45">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">LawMath.sol</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Engine equivalent</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LAW_MAPPING_SOLIDITY.map((row) => (
                <tr key={row.solidity} className="border-t border-white/[0.05]">
                  <td className="px-4 py-2.5 font-mono text-white/85">{row.solidity}</td>
                  <td className="px-4 py-2.5 font-mono text-white/55">{row.engine}</td>
                  <td className="px-4 py-2.5 text-white/60">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
