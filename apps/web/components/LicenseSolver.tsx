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
    <div className="rounded-xl border border-white/[0.06] bg-surface p-5 shadow-card">
      <h3 className="mb-3 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
        Licence board — a decaying reserve, not an order book
      </h3>
      <div className="overflow-x-auto">
        <table data-testid="license-solver" className="w-full text-left text-xs">
          <thead className="text-white/55">
            {/*
              * status sits fourth, not last.
              *
              * Six columns do not fit a 390px phone, and the table scrolls
              * rather than clipping -- so the responsive gate passes it, since
              * the content is reachable. But the column that fell off the edge
              * was `status`, which is the one that says whether you can buy at
              * all, and it was hidden by default while "share after" and
              * "burn" stayed in view. Nothing is hidden here; the decision
              * columns simply come first and the detail scrolls.
              */}
            <tr>
              <th className="py-1 pr-4 font-medium">plan</th>
              <th className="py-1 pr-4 font-medium">wait</th>
              <th className="py-1 pl-4 text-right font-medium">P</th>
              <th className="py-1 pl-4 pr-4 font-medium">status</th>
              <th className="py-1 pl-4 text-right font-medium">share after</th>
              <th className="py-1 pl-4 text-right font-medium">burn</th>
            </tr>
          </thead>
          <tbody className="tabular font-mono">
            {rows.map((r) => (
              <tr key={r.kind} data-testid={`plan-${r.kind}`} className="border-t border-white/5">
                <td className="py-1.5 pr-4 text-white/80">{KIND_LABEL[r.kind]}</td>
                <td className="py-1.5 pr-4 text-white/55">
                  {r.waitSeconds === 0 ? "0" : fmtDuration(r.waitSeconds)}
                </td>
                <td className="py-1.5 pl-4 text-right text-white/80">{fmtToken(r.P)}</td>
                <td className="py-1.5 pl-4 pr-4 whitespace-nowrap">
                  {r.available ? (
                    <span className="text-held">open</span>
                  ) : (
                    <span className="text-white/55">{r.reason ?? "unavailable"}</span>
                  )}
                </td>
                <td className="py-1.5 pl-4 text-right text-white/70">
                  {r.available ? `${(r.preview.share * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="py-1.5 pl-4 text-right text-white/70">
                  {r.available ? fmtToken(r.preview.Bdelta) : "—"}
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
      <p className="mt-2 text-[11px] text-white/55">
        Plans are priced on a clone. Nothing here buys anything — the cockpit does that.
      </p>
    </div>
  );
}
