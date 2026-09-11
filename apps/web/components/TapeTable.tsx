import type { TapeRow } from "@standard-law/engine";
import { fmtEth } from "@/lib/format";

/** The tape is a table, not a cartoon: one row per print, numbers aligned. */
export function TapeTable({ rows, emptyNote }: { rows: TapeRow[]; emptyNote?: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-white/10 bg-white/[0.02] p-3 text-xs text-white/55">
        {emptyNote ?? "No prints yet."}
      </p>
    );
  }
  return (
    <div className="max-h-64 overflow-auto rounded border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-ink text-white/55">
          <tr>
            <th className="px-2 py-1 font-medium">t</th>
            <th className="px-2 py-1 font-medium">op</th>
            <th className="px-2 py-1 text-right font-medium">ETH in</th>
            <th className="px-2 py-1 text-right font-medium">ETH out</th>
            <th className="px-2 py-1 text-right font-medium">F_n</th>
            <th className="px-2 py-1 font-medium">note</th>
          </tr>
        </thead>
        <tbody className="tabular font-mono">
          {rows.map((r, i) => (
            <tr key={`${r.t}-${r.op}-${i}`} className="border-t border-white/5">
              <td className="px-2 py-1 text-white/50">{r.t}</td>
              <td className="px-2 py-1 text-white/80">{r.op}</td>
              <td className="px-2 py-1 text-right text-white/70">{r.ethIn ? fmtEth(BigInt(r.ethIn)) : "—"}</td>
              <td className="px-2 py-1 text-right text-white/70">{r.ethOut ? fmtEth(BigInt(r.ethOut)) : "—"}</td>
              <td
                className={`px-2 py-1 text-right ${
                  r.regime === "expansion" ? "text-expansion" : "text-contraction"
                }`}
              >
                {r.Fn ? fmtEth(BigInt(r.Fn)) : "—"}
              </td>
              <td className="px-2 py-1 text-white/55">{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
