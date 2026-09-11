// A3 says a raise is a sign test rather than a size test. The sharp question
// that follows is what the *minimum* is: if only the sign matters, how little
// does it cost to walk the multiplier from its launch value to its ceiling?
//
// The answer is one wei per epoch, and it matters because the adversarial
// probes in packages/engine/src/adversary.ts conclude that slippage is what
// stops a pump -- measured against an 80 ETH round trip through a 100 ETH
// pool. A strategy that moves no size has nothing to slip.
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, applySwap, createWorld, seedGenesis, tick } from "@standard-law/engine";
import type { World } from "@standard-law/engine";

/** One-wei buys, one per epoch, until m stops climbing. */
function walkToCeiling() {
  let w: World = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 20);
  const startM = w.m;
  let weiIn = 0n;
  let epochs = 0;

  while (w.m < DEFAULT_PARAMS.mMax && epochs < 40) {
    const poolBefore = w.pool.eth;
    w = applySwap(w, "buyStd", 1n); // the smallest possible positive net flow
    weiIn += w.pool.eth - poolBefore;
    w = tick(w, DEFAULT_PARAMS.epochSeconds);
    epochs++;
  }
  return { world: w, startM, weiIn, epochs };
}

describe("A3 — what the sign test actually costs", () => {
  it("walks m to its ceiling on one wei per epoch", () => {
    const { world, startM, weiIn, epochs } = walkToCeiling();

    expect(startM).toBe(DEFAULT_PARAMS.mLaunch);
    expect(world.m).toBe(DEFAULT_PARAMS.mMax);

    // Six closes at the default raiseStep, and one wei put in at each.
    expect(epochs).toBe(6);
    expect(weiIn).toBe(6n);

    // For scale: six wei against a hundred-ETH pool.
    expect(weiIn).toBeLessThan(10n);
  });

  it("every one of those epochs closed on a single wei of net flow", () => {
    const { world } = walkToCeiling();
    // Nothing here needed size: each closed epoch is +1 wei, not a large buy.
    for (const closed of world.F) expect(closed).toBe(1n);
  });

  it("costs nothing in slippage, because nothing is round-tripped", () => {
    const { world } = walkToCeiling();
    // A one-wei buy returns no tokens at this pool depth, so the attacker
    // never sells anything back and never pays the spread the adversarial
    // probes measure. Supply is untouched: nothing minted, nothing burned.
    expect(world.M).toBe(0n);
    expect(world.B).toBe(0n);
  });

  it("holds the ceiling for as long as the wei keeps coming", () => {
    let { world } = walkToCeiling();
    for (let i = 0; i < 3; i++) {
      world = applySwap(world, "buyStd", 1n);
      world = tick(world, DEFAULT_PARAMS.epochSeconds);
    }
    expect(world.m).toBe(DEFAULT_PARAMS.mMax);
  });

  it("and gives it straight back the moment the wei stops", () => {
    let { world } = walkToCeiling();
    world = tick(world, DEFAULT_PARAMS.epochSeconds); // one quiet epoch
    // Cuts are immediate and a full cutStep, so the ceiling is not sticky.
    expect(world.m).toBeLessThan(DEFAULT_PARAMS.mMax);
    expect(world.m).toBe(DEFAULT_PARAMS.mMax - DEFAULT_PARAMS.cutStep);
  });
});
