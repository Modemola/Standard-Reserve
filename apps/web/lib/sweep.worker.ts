/// <reference lib="webworker" />
// The sweep runs off the main thread.
//
// A 30-cell grid at 3 seeds is roughly 4,000 simulated days of the full engine
// — several seconds of solid compute. On the main thread that is a frozen tab
// with no cursor and no way to cancel; the page could not even draw a progress
// bar, because it would never get a frame to draw it in.
//
// It also posts a *lean* view of each result. World state is bigint throughout,
// and while structured clone handles bigint fine, React state does not want it
// and neither does anything that formats a number. Converting once, here, keeps
// the whole of the UI in plain numbers.
import { DEFAULT_PARAMS } from "@standard-law/engine";
import { WORKLOADS, runSweep } from "@standard-law/engine";
import type { Params, Verdict } from "@standard-law/engine";

const WAD = 1e18;

export interface SweepCellView {
  overrides: Record<string, number>;
  verdicts: Verdict[];
  verdictRates: Partial<Record<Verdict, number>>;
  healthy: boolean;
  meanM: number;
  mDepth: number;
  mTrajectory: number[];
  epochsClosed: number;
  budgetUsed: number;
  timeAtFloor: number;
  timeAtCeiling: number;
  polEth: number;
  supplyCirc: number;
}

export interface SweepRequest {
  workload: string;
  horizonDays: number;
  seeds: number;
  seed: number;
  axes: { param: string; values: number[] }[];
}

export type SweepMessage =
  | { kind: "progress"; done: number; total: number }
  | { kind: "done"; cells: SweepCellView[]; healthyCount: number; skipped: number; ms: number }
  | { kind: "error"; message: string };

self.onmessage = (event: MessageEvent<SweepRequest>) => {
  const req = event.data;
  const post = (m: SweepMessage) => (self as unknown as Worker).postMessage(m);

  try {
    const workload = WORKLOADS[req.workload];
    if (!workload) throw new Error(`unknown workload: ${req.workload}`);

    const started = Date.now();
    const result = runSweep({
      base: DEFAULT_PARAMS,
      axes: req.axes as { param: keyof Params; values: number[] }[],
      workload,
      horizonDays: req.horizonDays,
      seed: req.seed,
      seeds: req.seeds,
      onProgress: (done, total) => post({ kind: "progress", done, total }),
    });

    post({
      kind: "done",
      ms: Date.now() - started,
      healthyCount: result.healthyCount,
      skipped: result.skipped,
      cells: result.cells.map((c) => ({
        overrides: c.overrides as Record<string, number>,
        verdicts: c.verdicts,
        verdictRates: c.verdictRates,
        healthy: c.healthy,
        meanM: c.meanM,
        mDepth: c.sample.mDepth,
        mTrajectory: c.sample.mTrajectory,
        epochsClosed: c.sample.epochsClosed,
        budgetUsed: c.sample.budgetUsed,
        timeAtFloor: c.sample.timeAtFloor,
        timeAtCeiling: c.sample.timeAtCeiling,
        polEth: Number(c.sample.polEth) / WAD,
        supplyCirc: Number(c.sample.supplyCirc) / WAD,
      })),
    });
  } catch (err) {
    post({ kind: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
