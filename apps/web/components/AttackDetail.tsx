import type { AttackFixture, Snapshot, Verdict } from "@standard-law/sentinel";
import { Explain } from "@/components/Explain";
import { TapeTable } from "./TapeTable";
import { VerdictPill } from "./VerdictPill";
import { fmtEth, fmtToken } from "@/lib/format";

function SnapshotGrid({ before, after }: { before: Snapshot; after: Snapshot }) {
  const rows: Array<[string, string, string]> = [
    ["epoch", String(before.epoch), String(after.epoch)],
    ["regime", before.regime, after.regime],
    ["m", before.m.toFixed(2), after.m.toFixed(2)],
    ["F_n (ETH)", fmtEth(BigInt(before.Fn)), fmtEth(BigInt(after.Fn))],
    ["signal (ETH)", fmtEth(BigInt(before.signal)), fmtEth(BigInt(after.signal))],
    ["S_circ", fmtToken(BigInt(before.S_circ)), fmtToken(BigInt(after.S_circ))],
    ["S_max", fmtToken(BigInt(before.S_max)), fmtToken(BigInt(after.S_max))],
    ["POL ETH", fmtEth(BigInt(before.polEth)), fmtEth(BigInt(after.polEth))],
    ["POL STD", fmtToken(BigInt(before.polStd)), fmtToken(BigInt(after.polStd))],
    ["contraction ETH", fmtEth(BigInt(before.contractionEth)), fmtEth(BigInt(after.contractionEth))],
    ["expansion gold", fmtToken(BigInt(before.expansionGold)), fmtToken(BigInt(after.expansionGold))],
    ["live branches", String(before.N), String(after.N)],
  ];
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-white/55">
        <tr>
          <th className="py-1 font-medium">field</th>
          <th className="py-1 text-right font-medium">before</th>
          <th className="py-1 text-right font-medium">after</th>
        </tr>
      </thead>
      <tbody className="tabular font-mono">
        {rows.map(([label, b, a]) => (
          <tr key={label} className="border-t border-white/5">
            <td className="py-1 text-white/55">{label}</td>
            <td className="py-1 text-right text-white/55">{b}</td>
            <td className={`py-1 text-right ${a !== b ? "text-paper" : "text-white/55"}`}>{a}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AttackDetail({
  fixture,
  verdict,
  onRunThis,
  onReplayInLab,
  onDownload,
  busy,
}: {
  fixture: AttackFixture;
  verdict?: Verdict;
  onRunThis: () => void;
  onReplayInLab: () => void;
  onDownload: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-sm text-white/85">{fixture.id}</h2>
          <VerdictPill status={verdict ? verdict.status : "pending"} size="lg" />
          {verdict?.status === "held" && <Explain k="verdictHeld" label="a held verdict" />}
          {verdict?.status === "cheap" && <Explain k="verdictCheap" label="a cheap verdict" />}
          {verdict?.status === "broken" && <Explain k="verdictBroken" label="a broken verdict" />}
          <span className="font-mono text-xs text-white/55">{fixture.wp}</span>
          <span className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-white/55">
            {fixture.severity}
          </span>
        </div>
        <p className="mt-2 text-sm text-white/60">{fixture.teach}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRunThis}
          disabled={busy}
          data-testid="run-this"
          className="rounded border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Run this
        </button>
        <button
          onClick={onReplayInLab}
          disabled={busy || !verdict || verdict.status === "pending"}
          data-testid="replay-in-lab"
          className="rounded border border-expansion/40 bg-expansion/10 px-3 py-1.5 text-xs text-expansion disabled:opacity-40"
        >
          Replay in Lab
        </button>
        <button
          onClick={onDownload}
          disabled={!verdict}
          className="rounded border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Download verdict.json
        </button>
      </div>

      {verdict?.status === "cheap" && verdict.notes && (
        <div
          data-testid="cheap-note"
          className="rounded border border-cheap/40 bg-cheap/10 p-3 text-xs text-cheap"
        >
          {verdict.notes}
        </div>
      )}

      {verdict && verdict.broken.length > 0 && (
        <div className="rounded border border-broken/50 bg-broken/10 p-3 text-xs text-broken">
          <p className="mb-1 font-medium uppercase tracking-widest">Invariants broken</p>
          <ul className="list-disc pl-4">
            {verdict.broken.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict && verdict.unexpected.length > 0 && (
        <div className="rounded border border-broken/40 bg-broken/5 p-3 text-xs text-broken/90">
          <p className="mb-1 font-medium uppercase tracking-widest">Unexpected</p>
          <ul className="list-disc pl-4">
            {verdict.unexpected.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict && (
        <>
          <div className="rounded-xl border border-white/[0.06] bg-surface p-5 shadow-card">
            <h3 className="mb-2 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
              Before / after
            </h3>
            <SnapshotGrid before={verdict.before} after={verdict.after} />
          </div>

          <div>
            <h3 className="mb-2 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">Tape</h3>
            <TapeTable rows={verdict.tape} emptyNote="This attack moved nothing." />
          </div>

          <p className="font-mono text-[11px] text-white/55">
            world hash after: {verdict.worldHashAfter || "—"}
          </p>
        </>
      )}
    </div>
  );
}
