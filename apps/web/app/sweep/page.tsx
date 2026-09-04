"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VERDICT_MEANING, WORKLOADS } from "@standard-law/engine";
import type { Verdict } from "@standard-law/engine";
import { AlertTriangle, Play, Loader2 } from "lucide-react";
import { Card } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { CONTRACTION, EXPANSION } from "@/lib/palette";
import type { SweepCellView, SweepMessage, SweepRequest } from "@/lib/sweep.worker";

/** The two axes that decide whether issuance regulates anything: how far m may
 *  travel, and how hard a bad epoch cuts it. Same grid the CLI uses. */
const AXES = [
  { param: "mMax", values: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] },
  { param: "cutStep", values: [0.05, 0.1, 0.25, 0.5, 0.75] },
];

const SHORT: Record<Verdict, string> = {
  invariant_break: "break",
  budget_exhausted: "budget",
  cut_never_bit: "no cut",
  issuance_dead: "dead",
  issuance_pinned: "pinned",
  pol_stalled: "no POL",
  policy_inert: "inert",
};

const WORKLOAD_IDS = Object.keys(WORKLOADS);

export default function SweepPage() {
  const [workload, setWorkload] = useState(WORKLOAD_IDS[0]);
  const [horizonDays, setHorizonDays] = useState(45);
  const [seeds, setSeeds] = useState(3);
  const [cells, setCells] = useState<SweepCellView[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ healthy: number; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SweepCellView | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // One worker for the page's lifetime. Terminated on unmount so a navigation
  // mid-sweep does not leave a thread burning CPU behind the next page.
  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const run = useCallback(() => {
    setError(null);
    setSelected(null);
    setCells(null);
    setSummary(null);
    setProgress({ done: 0, total: AXES[0].values.length * AXES[1].values.length });

    workerRef.current?.terminate();
    const worker = new Worker(new URL("../../lib/sweep.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<SweepMessage>) => {
      const msg = event.data;
      if (msg.kind === "progress") setProgress({ done: msg.done, total: msg.total });
      else if (msg.kind === "error") {
        setError(msg.message);
        setProgress(null);
      } else {
        setCells(msg.cells);
        setSummary({ healthy: msg.healthyCount, ms: msg.ms });
        setProgress(null);
      }
    };
    worker.onerror = (e) => {
      setError(e.message || "the sweep worker failed to start");
      setProgress(null);
    };

    const req: SweepRequest = { workload, horizonDays, seeds, seed: 1, axes: AXES };
    worker.postMessage(req);
  }, [workload, horizonDays, seeds]);

  const [rowAxis, colAxis] = AXES;
  const cellAt = (row: number, col: number) =>
    cells?.find((c) => c.overrides[rowAxis.param] === row && c.overrides[colAxis.param] === col);

  const running = progress !== null;
  const active = WORKLOADS[workload];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="optical-title font-display text-3xl text-paper">Sweep</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/60">
          The Lab drives one world down one path — that shows you what the policy{" "}
          <em>did</em>, never whether it is sound. A sweep runs a grid of parameter values
          across a fixed market and reports where the policy degenerates.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
          Every cell runs the identical workload, so a difference between cells is the
          parameter rather than noise; and every cell runs several seeds, so a verdict means
          the setting fails <em>reliably</em>. Degeneracy is judged relative to the market —
          m riding its ceiling under sustained inflow is the policy working.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[11px] uppercase tracking-wide text-white/55">
              market
            </legend>
            <div className="flex flex-wrap gap-2">
              {WORKLOAD_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWorkload(id)}
                  aria-pressed={workload === id}
                  className={
                    workload === id
                      ? "rounded-lg border border-expansion/40 bg-expansion/10 px-3 py-1.5 font-mono text-xs text-expansion"
                      : "rounded-lg border border-white/[0.1] px-3 py-1.5 font-mono text-xs text-white/70 transition-colors duration-150 hover:text-paper"
                  }
                >
                  {id}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="text-[11px] uppercase tracking-wide text-white/55">
            days
            <input
              type="number"
              min={10}
              max={180}
              value={horizonDays}
              onChange={(e) => setHorizonDays(Math.max(10, Math.min(180, Number(e.target.value))))}
              className="mt-1 block w-20 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 font-mono text-sm text-paper/90 transition-colors duration-150 focus:border-white/25"
            />
          </label>

          <label className="text-[11px] uppercase tracking-wide text-white/55">
            seeds / cell
            <input
              type="number"
              min={1}
              max={10}
              value={seeds}
              onChange={(e) => setSeeds(Math.max(1, Math.min(10, Number(e.target.value))))}
              className="mt-1 block w-20 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 font-mono text-sm text-paper/90 transition-colors duration-150 focus:border-white/25"
            />
          </label>

          <button
            type="button"
            onClick={run}
            disabled={running}
            data-testid="run-sweep"
            className="inline-flex items-center gap-2 rounded-lg border border-expansion/40 bg-expansion/10 px-5 py-2 text-sm text-expansion shadow-glow-expansion transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {running ? "running…" : "run sweep"}
          </button>
        </div>

        <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-white/60">
          <span className="font-mono text-white/75">{workload}</span> — {active?.description}
        </p>

        {running && (
          <div className="mt-3" role="status" aria-live="polite">
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-expansion transition-[width] duration-150"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 tabular font-mono text-[11px] text-white/60">
              {progress.done} / {progress.total} cells
            </p>
          </div>
        )}
      </Card>

      {error && (
        <Card className="border-contraction/40">
          <p className="flex items-center gap-2 text-sm text-contraction">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        </Card>
      )}

      {cells && summary && (
        <>
          <Card>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
                {rowAxis.param} × {colAxis.param}
              </h2>
              <p className="tabular font-mono text-xs text-white/60">
                {summary.healthy}/{cells.length} healthy · {seeds} seeds · {horizonDays}d ·{" "}
                {(summary.ms / 1000).toFixed(1)}s
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center">
                <caption className="sr-only">
                  Sweep results: each cell is a parameter combination, marked healthy or with
                  its most severe verdict.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-20 text-left text-[11px] uppercase tracking-wide text-white/55">
                      {rowAxis.param}
                    </th>
                    {colAxis.values.map((cv) => (
                      <th
                        key={cv}
                        scope="col"
                        className="tabular font-mono text-[11px] font-normal text-white/60"
                      >
                        {cv}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowAxis.values.map((rv) => (
                    <tr key={rv}>
                      <th
                        scope="row"
                        className="tabular text-left font-mono text-[11px] font-normal text-white/60"
                      >
                        {rv}
                      </th>
                      {colAxis.values.map((cv) => {
                        const cell = cellAt(rv, cv);
                        if (!cell)
                          return (
                            <td key={cv} className="text-white/25">
                              ·
                            </td>
                          );
                        const worst = cell.verdicts[0];
                        return (
                          <td key={cv}>
                            <button
                              type="button"
                              onClick={() => setSelected(cell)}
                              aria-label={`${rowAxis.param} ${rv}, ${colAxis.param} ${cv}: ${
                                cell.healthy ? "healthy" : VERDICT_MEANING[worst]
                              }`}
                              className={
                                "w-full rounded-md border px-2 py-2 font-mono text-[11px] transition-transform duration-150 hover:scale-[1.04] " +
                                (cell.healthy
                                  ? "border-expansion/30 bg-expansion/[0.10] text-expansion"
                                  : "border-contraction/35 bg-contraction/[0.12] text-contraction") +
                                (selected === cell ? " ring-2 ring-white/40" : "")
                              }
                            >
                              {cell.healthy ? "ok" : SHORT[worst]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-white/60">
              Select a cell to see its run. Colour is verdict, not magnitude — a cell is red
              when its verdict fired in a majority of seeds.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
                {selected ? "Selected cell" : "Verdicts in this run"}
              </h2>
              {selected ? (
                <div className="space-y-3 text-sm">
                  <p className="tabular font-mono text-xs text-white/75">
                    {Object.entries(selected.overrides)
                      .map(([k, v]) => `${k}=${v}`)
                      .join("  ")}
                  </p>
                  <Sparkline
                    values={selected.mTrajectory}
                    stroke={selected.healthy ? EXPANSION : CONTRACTION}
                    width={320}
                    height={56}
                    className="w-full"
                  />
                  <p className="text-[11px] text-white/60">
                    m across {selected.epochsClosed} closed epochs (first seed)
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 font-mono text-xs">
                    <Metric label="mean m" value={selected.meanM.toFixed(3)} />
                    <Metric label="depth" value={selected.mDepth.toFixed(2)} />
                    <Metric label="at floor" value={`${(selected.timeAtFloor * 100).toFixed(0)}%`} />
                    <Metric
                      label="at ceiling"
                      value={`${(selected.timeAtCeiling * 100).toFixed(0)}%`}
                    />
                    <Metric label="budget used" value={`${(selected.budgetUsed * 100).toFixed(2)}%`} />
                    <Metric label="POL ETH" value={selected.polEth.toFixed(4)} />
                  </dl>
                  {selected.verdicts.length > 0 && (
                    <ul className="space-y-2 border-t border-white/[0.06] pt-3">
                      {selected.verdicts.map((v) => (
                        <li key={v} className="text-xs leading-relaxed text-contraction">
                          <span className="font-mono">{v}</span>{" "}
                          <span className="text-white/60">
                            ({((selected.verdictRates[v] ?? 0) * 100).toFixed(0)}% of seeds)
                          </span>
                          <br />
                          <span className="text-white/60">{VERDICT_MEANING[v]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {tally(cells).map(([v, n]) => (
                    <li key={v} className="text-xs leading-relaxed">
                      <span className="tabular font-mono text-contraction">
                        {n} cell{n === 1 ? "" : "s"}
                      </span>{" "}
                      <span className="font-mono text-white/75">{v}</span>
                      <br />
                      <span className="text-white/60">{VERDICT_MEANING[v]}</span>
                    </li>
                  ))}
                  {tally(cells).length === 0 && (
                    <li className="text-xs text-white/60">
                      No verdicts fired — every cell in this grid held up under this market.
                    </li>
                  )}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
                Reading this honestly
              </h2>
              <div className="space-y-3 text-xs leading-relaxed text-white/60">
                <p>
                  Several constants in this simulator are still unpublished placeholders — see
                  the params drawer in the Lab. A sweep tells you about the <em>shape</em> of
                  the model. It cannot tell you the real protocol is well calibrated.
                </p>
                <p>
                  A verdict names a structural failure — issuance stuck at its floor, the 900M
                  budget gone inside the horizon, liquidity never forming. It is not a
                  judgement that a number is &ldquo;wrong&rdquo;.
                </p>
                <p>
                  Cells are deterministic: the same seeds and horizon reproduce this grid
                  exactly, here or from{" "}
                  <span className="font-mono text-white/75">pnpm sweep</span>.
                </p>
              </div>
            </Card>
          </div>
        </>
      )}

      {!cells && !running && !error && (
        <Card className="text-center">
          <p className="text-sm text-white/60">
            Pick a market and run the sweep. It executes off the main thread, so the page stays
            responsive while roughly four thousand simulated days run.
          </p>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-white/55">{label}</dt>
      <dd className="tabular mt-0.5 text-white/90">{value}</dd>
    </div>
  );
}

function tally(cells: SweepCellView[]): [Verdict, number][] {
  const counts = new Map<Verdict, number>();
  for (const c of cells) for (const v of c.verdicts) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}
