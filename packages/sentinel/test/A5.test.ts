// A5 says the regime threshold is exactly zero with no deadband. The fixture
// can show an epoch landing on that threshold, but not what sits either side
// of it, and "the regime flickers" undersells it: what one wei actually
// decides is where 70% of an epoch's fee income goes, and whether issuance is
// cut at all.
//
// Both sides are run here, identical but for a single wei of net flow.
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, applySwap, createWorld, seedGenesis, tick } from "@standard-law/engine";
import type { World } from "@standard-law/engine";

/** Trade both ways so there is real fee income, landing net flow on `net`. */
function epochClosingAt(net: bigint) {
  let w: World = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 20);
  w = applySwap(w, "buyStd", 5n * 10n ** 18n);

  // Sell back everything that came in, less the wei we want left over.
  const target = w.ethInEpoch - net;
  let lo = 1n;
  let hi = w.pool.std;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (applySwap(w, "sellStd", mid).ethOutEpoch >= target) hi = mid;
    else lo = mid + 1n;
  }
  w = applySwap(w, "sellStd", lo);

  const feeIncome = w.feeBucketEth;
  const netFlow = w.ethInEpoch - w.ethOutEpoch;
  const mBefore = w.m;
  w = tick(w, DEFAULT_PARAMS.epochSeconds);
  return { world: w, feeIncome, netFlow, mBefore };
}

describe("A5 — the regime threshold is a knife edge", () => {
  it("routes 70% of the epoch's fees to opposite vaults, on one wei", () => {
    const zero = epochClosingAt(0n);
    const oneWei = epochClosingAt(1n);

    // The two runs are identical but for that wei.
    expect(zero.netFlow).toBe(0n);
    expect(oneWei.netFlow).toBe(1n);
    expect(zero.feeIncome).toBe(oneWei.feeIncome);
    expect(zero.feeIncome).toBeGreaterThan(0n); // there is real income to route

    // Zero counts as contraction, so the contraction vault is funded and the
    // expansion vault gets nothing...
    expect(zero.world.vaults.expansionEth).toBe(0n);
    // ...and one wei the other way inverts it. (The contraction vault is spent
    // down by the hourly buyback, so it is checked for having been funded via
    // the burn rather than by its closing balance.)
    expect(oneWei.world.vaults.expansionEth).toBeGreaterThan(0n);
    expect(oneWei.world.vaults.contractionEth).toBe(0n);
  });

  it("decides whether issuance is cut at all", () => {
    const zero = epochClosingAt(0n);
    const oneWei = epochClosingAt(1n);

    // F_n <= 0 cuts immediately; F_n > 0 with no positive signal behind it
    // leaves m alone. So the same wei that moves the fees also decides the cut.
    expect(zero.world.m).toBeLessThan(zero.mBefore);
    expect(oneWei.world.m).toBe(oneWei.mBefore);
    expect(oneWei.world.m).toBeGreaterThan(zero.world.m);
  });

  it("the burn tells the same story: only the zero-flow epoch buys back", () => {
    const zero = epochClosingAt(0n);
    const oneWei = epochClosingAt(1n);

    // A funded contraction vault spends into the pool and burns what it buys.
    expect(zero.world.B).toBeGreaterThan(oneWei.world.B);
  });
});
