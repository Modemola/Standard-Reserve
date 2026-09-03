import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { GENESIS_POL, HARD_CAP } from "../src/constants.js";
import { applySwap, createWorld, invariantCheck, seedGenesis, supplyCirc, supplyMax, tick } from "../src/index.js";

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("supply identities", () => {
  it("S_circ = GENESIS_POL + M - B and S_max = HARD_CAP - B after 100 random swaps", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 5);
    const rand = lcg(42);
    let prevB = world.B;

    for (let i = 0; i < 100; i++) {
      if (rand() < 0.5) {
        world = applySwap(world, "buyStd", BigInt(Math.floor(rand() * 1e18) + 1));
      } else {
        world = applySwap(world, "sellStd", BigInt(Math.floor(rand() * 1e17) + 1));
      }
      world = tick(world, 3600);

      expect(supplyCirc(world)).toBe(GENESIS_POL + world.M - world.B);
      expect(supplyMax(world)).toBe(HARD_CAP - world.B);
      expect(world.B).toBeGreaterThanOrEqual(prevB); // burns only accumulate
      prevB = world.B;

      const inv = invariantCheck(world);
      expect(inv.ok, JSON.stringify(inv.failures)).toBe(true);
    }
  });

  it("S_max only decreases across a burn-producing sequence", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 2);
    let prevMax = supplyMax(world);
    for (let i = 0; i < 10; i++) {
      world = applySwap(world, "sellStd", 10n ** 16n);
      world = tick(world, DEFAULT_PARAMS.epochSeconds);
      const max = supplyMax(world);
      expect(max).toBeLessThanOrEqual(prevMax);
      prevMax = max;
    }
  });
});
