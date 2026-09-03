import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { applySwap, closeEpochIfDue, createWorld, seedGenesis, tick } from "../src/index.js";

describe("wash trading", () => {
  it("equal buy+sell in the same epoch does not pump F_n", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 3);

    const volume = 10n ** 17n; // 0.1 ETH
    const stdBefore = world.pool.std;
    world = applySwap(world, "buyStd", volume);
    const stdReceived = stdBefore - world.pool.std;
    world = applySwap(world, "sellStd", stdReceived);

    world = tick(world, DEFAULT_PARAMS.epochSeconds); // force epoch close
    world = closeEpochIfDue(world);

    const F_n = world.F[world.F.length - 1];
    const magnitude = F_n < 0n ? -F_n : F_n;
    // Only fee/slippage asymmetry should show up, not the round-tripped volume itself.
    expect(magnitude).toBeLessThan(volume / 10n);
  });
});
