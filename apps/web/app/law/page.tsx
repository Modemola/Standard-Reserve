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
        <h1 className="text-2xl font-semibold">Law</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/60">
          Every number the engine produces traces back to a whitepaper section here — nothing in
          this simulator is invented. Where the whitepaper leaves a constant unpublished, the
          params drawer in the Lab says so; this table says where the formula that uses it lives.
          See also <code className="font-mono text-white/80">docs/LAW.md</code>.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/50">
            <tr>
              <th className="px-4 py-2 font-medium">Function</th>
              <th className="px-4 py-2 font-medium">Whitepaper section</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {LAW_MAPPING.map((row) => (
              <tr key={row.engine} className="border-t border-white/10">
                <td className="px-4 py-2 font-mono text-white/80">{row.engine}</td>
                <td className="px-4 py-2 text-white/60">{row.wp}</td>
                <td className="px-4 py-2 text-white/40">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-medium text-white/80">Phase 2 — Sentinel attacks</h2>
        <p className="mt-1 max-w-2xl text-xs text-white/50">
          Each fixture in <code className="font-mono text-white/70">/attacks</code> leans on one of
          the rules above. A verdict of HELD means the rule stopped the attack; CHEAP means it was
          allowed but the incentive is worth naming. Run them yourself on{" "}
          <code className="font-mono text-white/70">/sentinel</code>.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">Attack</th>
                <th className="px-4 py-2 font-medium">Whitepaper section</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LAW_MAPPING_SENTINEL.map((row) => (
                <tr key={row.engine} className="border-t border-white/10">
                  <td className="px-4 py-2 font-mono text-white/80">{row.engine}</td>
                  <td className="px-4 py-2 text-white/60">{row.wp}</td>
                  <td className="px-4 py-2 text-white/40">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-white/80">Phase 2 — Open Market Desk quotes</h2>
        <p className="mt-1 max-w-2xl text-xs text-white/50">
          The Desk prices only the moves the bank actually has. Every quote is a pure function of a
          cloned world, so reading a price can never change one.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">Quote</th>
                <th className="px-4 py-2 font-medium">Whitepaper section</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LAW_MAPPING_DESK.map((row) => (
                <tr key={row.engine} className="border-t border-white/10">
                  <td className="px-4 py-2 font-mono text-white/80">{row.engine}</td>
                  <td className="px-4 py-2 text-white/60">{row.wp}</td>
                  <td className="px-4 py-2 text-white/40">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-white/80">Phase E — Solidity twins (audit narrative)</h2>
        <p className="mt-1 max-w-2xl text-xs text-white/50">
          <code className="font-mono text-white/70">contracts/law/src/LawMath.sol</code> re-implements
          three of the formulas above in Solidity so an auditor can check the TS engine against an
          independent implementation. It is never deployed. Checked against vectors generated from
          the live engine — see{" "}
          <code className="font-mono text-white/70">contracts/law/test/LawMath.t.sol</code>.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">LawMath.sol</th>
                <th className="px-4 py-2 font-medium">Engine equivalent</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LAW_MAPPING_SOLIDITY.map((row) => (
                <tr key={row.solidity} className="border-t border-white/10">
                  <td className="px-4 py-2 font-mono text-white/80">{row.solidity}</td>
                  <td className="px-4 py-2 font-mono text-white/60">{row.engine}</td>
                  <td className="px-4 py-2 text-white/40">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
