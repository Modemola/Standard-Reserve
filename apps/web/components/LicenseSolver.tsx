import Link from "next/link";
import type { LicensePlanRow } from "@standard-law/desk";
import { fmtDuration, fmtToken } from "@/lib/format";

const KIND_LABEL: Record<LicensePlanRow["kind"], string> = {
  now: "hit now",
  wait: "wait",
  floor: "floor",
};

export function LicenseSolver({ rows, charterId }: { rows: LicensePlanRow[]; charterId: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-white/50">
        Licence board — a decaying reserve, not an order book
      </h3>
      <div className="overflow-x-auto">
        <table data-testid="license-solver" className="w-full text-left text-xs">
          <thead className="text-white/40">
            <tr>
              <th className="py-1 font-medium">plan</th>
              <th className="py-1 font-medium">wait</th>
              <th className="py-1 text-right font-medium">P</th>
              <th className="py-1 text-right font-medium">share after</th>
              <th className="py-1 text-right font-medium">burn</th>
              <th className="py-1 font-medium">status</th>
            </tr>
          </thead>
          <tbody className="tabular font-mono">
            {rows.map((r) => (
              <tr key={r.kind} data-testid={`plan-${r.kind}`} className="border-t border-white/5">
                <td className="py-1.5 text-white/80">{KIND_LABEL[r.kind]}</td>
                <td className="py-1.5 text-white/55">
                  {r.waitSeconds === 0 ? "0" : fmtDuration(r.waitSeconds)}
                </td>
                <td className="py-1.5 text-right text-white/80">{fmtToken(r.P)}</td>
                <td className="py-1.5 text-right text-white/70">
                  {r.available ? `${(r.preview.share * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="py-1.5 text-right text-white/70">
                  {r.available ? fmtToken(r.preview.Bdelta) : "—"}
                </td>
                <td className="py-1.5">
                  {r.available ? (
                    <span className="text-held">open</span>
                  ) : (
                    <span className="text-white/40">{r.reason ?? "unavailable"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link
        href={`/bank/${charterId}`}
        className="mt-3 inline-block rounded border border-white/15 px-3 py-1.5 text-xs text-white/75"
      >
        Send to cockpit
      </Link>
      <p className="mt-2 text-[11px] text-white/35">
        Plans are priced on a clone. Nothing here buys anything — the cockpit does that.
      </p>
    </div>
  );
}
