import { LAW_MAPPING } from "@/lib/law-mapping";

export default function LawPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Law</h1>
        <p className="mt-1 text-sm text-white/60">
          Where each engine/UI function traces back to the whitepaper. See also{" "}
          <code className="font-mono text-white/80">docs/LAW.md</code>.
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
    </div>
  );
}
