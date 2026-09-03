import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { applySwap, createWorld, seedGenesis, tick } from "../src/index.js";

describe("protocol-owned liquidity", () => {
  it("polEth and polStd never decrease", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 3);
    let prevEth = world.polEth;
    let prevStd = world.polStd;

    for (let i = 0; i < 5; i++) {
      world = applySwap(world, "buyStd", 10n ** 17n);
      world = tick(world, DEFAULT_PARAMS.epochSeconds); // forces an epoch close -> fee split
      expect(world.polEth).toBeGreaterThanOrEqual(prevEth);
      expect(world.polStd).toBeGreaterThanOrEqual(prevStd);
      prevEth = world.polEth;
      prevStd = world.polStd;
    }
    expect(prevEth).toBeGreaterThan(0n);
  });

  it("the contraction vault only spends ETH through the buyback burn path", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 2);
    world = applySwap(world, "sellStd", 10n ** 16n); // push into contraction
    world = tick(world, DEFAULT_PARAMS.epochSeconds); // close epoch, fund contraction vault
    const bBefore = world.B;
    const vaultBefore = world.vaults.contractionEth;

    world = tick(world, 3 * 3600); // run a few hourly buybacks
    expect(world.vaults.contractionEth).toBeLessThanOrEqual(vaultBefore);
    if (world.vaults.contractionEth < vaultBefore) {
      expect(world.B).toBeGreaterThan(bBefore); // spend only happens alongside a burn
    }
  });
});
