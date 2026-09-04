import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { WORKLOADS, runCell, runSweep } from "../src/sweep.js";
import type { Params } from "../src/types.js";

/**
 * The sweep is an instrument, so what needs guarding is not "does it run" but
 * "does it measure the thing it claims to". Three of these tests exist because
 * the first drafts got it wrong: verdicts that judged every market by the same
 * rule, a "directionless" workload whose direction depended on the seed, and a
 * single-seed cell that reported a finding which vanished on 3 seeds in 5.
 */

const HORIZON = 40;

function withParams(over: Partial<Params>): Params {
  const p = { ...DEFAULT_PARAMS, ...over } as Params;
  p.mLaunch = Math.min(Math.max(p.mLaunch, p.mMin), p.mMax);
  return p;
}

describe("sweep", () => {
  it("is deterministic: the same seed gives the same run", () => {
    const a = runCell(DEFAULT_PARAMS, WORKLOADS.choppy, HORIZON, 7, 5);
    const b = runCell(DEFAULT_PARAMS, WORKLOADS.choppy, HORIZON, 7, 5);
    expect(a.metrics).toEqual(b.metrics);
    expect(a.verdicts).toEqual(b.verdicts);
  });

  it("gives different runs for different seeds", () => {
    // Guards the guard above: if the rng were ignored, determinism would be
    // trivially true and would prove nothing.
    //
    // Compared on supply rather than on m. Under choppy, m turns only on the
    // *sign* of each epoch's flow, and the sign is now fixed by day parity --
    // so its trajectory is identical across seeds by design. That is the
    // workload being genuinely directionless, not the rng being ignored, and
    // asserting on m here would have failed for the right reason in the wrong
    // place. The seed still drives trade sizes, which supply records.
    const a = runCell(DEFAULT_PARAMS, WORKLOADS.choppy, HORIZON, 1, 5);
    const b = runCell(DEFAULT_PARAMS, WORKLOADS.choppy, HORIZON, 2, 5);
    expect(a.metrics.supplyCirc).not.toEqual(b.metrics.supplyCirc);
  });

  it("choppy is directionless by construction, not by luck", () => {
    // The first version drew buy and sell magnitudes independently and in
    // different units, so whether a run drifted up or down was a function of
    // the seed -- and the sweep reported a ratchet that disappeared on 3 seeds
    // out of 5. It now sells back exactly what it bought, so the only net
    // drift is the pool fee.
    for (let seed = 1; seed <= 8; seed++) {
      const { metrics } = runCell(
        withParams({ cutStep: 0.05 }),
        WORKLOADS.choppy,
        HORIZON,
        seed,
        5,
      );
      // With the ratchet switched off (cutStep == raiseStep), a directionless
      // market must leave issuance near where it launched, on every seed.
      expect(Math.abs(metrics.mDepth), `seed ${seed} drifted`).toBeLessThan(0.2);
    }
  });

  it("finds the ratchet: any cutStep above raiseStep sinks issuance under churn", () => {
    // The mechanism, not a tuned threshold. Under alternating buy/sell each
    // epoch, a raise fires on buy days and a cut on sell days, so m drifts by
    // (raiseStep - cutStep) per cycle. At or below raiseStep it holds; above
    // it, issuance walks to the floor however balanced the market is.
    const raise = DEFAULT_PARAMS.raiseStep;

    const held = runCell(withParams({ cutStep: raise }), WORKLOADS.choppy, HORIZON, 1, 5);
    expect(held.verdicts).not.toContain("issuance_dead");

    // The mechanism itself: deeper cut, deeper sink, monotonically.
    let previous = held.metrics.mDepth;
    for (const cutStep of [raise * 2, raise * 5, raise * 10]) {
      const sunk = runCell(withParams({ cutStep }), WORKLOADS.choppy, HORIZON, 1, 5);
      expect(sunk.metrics.mDepth, `cutStep ${cutStep}`).toBeGreaterThan(previous);
      previous = sunk.metrics.mDepth;
    }

    // The verdict is asserted only where the drift has had time to complete.
    // At raise*2 the per-cycle drift is one twentieth of the range, so over a
    // short horizon it lands mid-range -- correctly, and the test says so
    // rather than stretching the threshold to cover it.
    const dead = runCell(withParams({ cutStep: raise * 5 }), WORKLOADS.choppy, HORIZON, 1, 5);
    expect(dead.verdicts).toContain("issuance_dead");
  });

  it("judges each market by what it should produce, not by one fixed rule", () => {
    // Sustained inflow pins m to the ceiling. That is the policy working, and
    // an earlier version reported every such cell as a failure -- 0% healthy
    // across the entire grid, which told the reader nothing.
    const inflow = runCell(DEFAULT_PARAMS, WORKLOADS.steady_inflow, HORIZON, 1, 5);
    expect(inflow.metrics.timeAtCeiling).toBeGreaterThan(0.5);
    expect(inflow.verdicts).not.toContain("issuance_pinned");
    expect(inflow.verdicts).not.toContain("policy_inert");

    // A sustained outflow driving m down is likewise correct, not a defect.
    const shock = runCell(DEFAULT_PARAMS, WORKLOADS.outflow_shock, HORIZON, 1, 5);
    expect(shock.verdicts).not.toContain("issuance_dead");
  });

  it("flags a cut that never bites when the flow reverses", () => {
    // cutStep at its smallest against a heavy outflow: m should barely move,
    // which is the failure this verdict exists to name.
    const { verdicts } = runCell(
      withParams({ cutStep: 0.0001, mMax: 1.25 }),
      WORKLOADS.outflow_shock,
      HORIZON,
      1,
      5,
    );
    expect(verdicts).toContain("cut_never_bit");
  });

  it("aggregates a cell over seeds rather than trusting one run", () => {
    const result = runSweep({
      base: DEFAULT_PARAMS,
      axes: [{ param: "cutStep", values: [0.05, 0.5] }],
      workload: WORKLOADS.choppy,
      horizonDays: HORIZON,
      seed: 1,
      seeds: 4,
    });
    expect(result.cells).toHaveLength(2);
    for (const cell of result.cells) {
      expect(cell.runs).toBe(4);
      // A verdict is only reported when it fires in a majority of seeds.
      for (const v of cell.verdicts) expect(cell.verdictRates[v]!).toBeGreaterThan(0.5);
    }
    expect(result.cells[0].healthy).toBe(true);
    expect(result.cells[1].verdicts).toContain("issuance_dead");
  });

  it("skips configurations the schema would reject instead of reporting them", () => {
    // An impossible config is not a finding about the policy.
    const result = runSweep({
      base: DEFAULT_PARAMS,
      axes: [{ param: "feeFloor", values: [0.01, 0.9] }], // 0.9 > feeCeil 0.35
      workload: WORKLOADS.steady_inflow,
      horizonDays: 5,
      seed: 1,
      seeds: 1,
    });
    expect(result.skipped).toBe(1);
    expect(result.cells).toHaveLength(1);
  });

  it("clamps mLaunch into a swept range rather than blanking the row", () => {
    // Sweeping mMax below the default mLaunch of 1.0 would otherwise put every
    // such cell outside its own range and drop it -- the first run reported
    // two entirely empty rows, which says nothing about the policy.
    const result = runSweep({
      base: DEFAULT_PARAMS,
      axes: [{ param: "mMax", values: [0.5, 0.75] }],
      workload: WORKLOADS.steady_inflow,
      horizonDays: 5,
      seed: 1,
      seeds: 1,
    });
    expect(result.skipped).toBe(0);
    expect(result.cells).toHaveLength(2);
  });
});
