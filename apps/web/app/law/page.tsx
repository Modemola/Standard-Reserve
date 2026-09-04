import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Law",
  description:
    "Every formula the engine implements, mapped to the whitepaper section it comes from and the file it lives in.",
};

import { LAW_MAPPING, LAW_MAPPING_SOLIDITY } from "@/lib/law-mapping";

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

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface shadow-card">
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
          Phase E — Solidity twins (audit narrative)
        </h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45">
          <code className="font-mono text-white/65">contracts/law/src/LawMath.sol</code> re-implements
          three of the formulas above in Solidity so an auditor can check the TS engine against an
          independent implementation. It is never deployed. Checked against vectors generated from
          the live engine — see{" "}
          <code className="font-mono text-white/65">contracts/law/test/LawMath.t.sol</code>.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-surface shadow-card">
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
