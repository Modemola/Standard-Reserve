import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { buyLicense, createWorld, seedGenesis, tick } from "../src/index.js";

describe("branch lifecycle", () => {
  it("a branch earns nothing for time before its openedAt", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];

    world = tick(world, 3600); // only branch 0 exists
    const creditsAfterFirstTick = world.issuanceCreditsCum;
    expect(world.charters[id].branches[0].ledger).toBe(creditsAfterFirstTick);
    expect(creditsAfterFirstTick).toBeGreaterThan(0n);

    world = buyLicense(world, id); // branch 1 opens now
    expect(world.lastError).toBeUndefined();
    expect(world.charters[id].branches[1].ledger).toBe(0n);

    world = tick(world, 3600); // both branches live for this tick
    const b0 = world.charters[id].branches[0].ledger;
    const b1 = world.charters[id].branches[1].ledger;
    expect(b1).toBeGreaterThan(0n);
    expect(b1).toBeLessThan(b0); // b0 also carries the pre-existence-of-b1 credits
  });

  it("rejects an 11th branch once maxBranches is reached", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];

    for (let i = 0; i < 9; i++) {
      if (i > 0 && i % 3 === 0) world = tick(world, 86_400); // reset daily license cap
      world = buyLicense(world, id);
      expect(world.lastError, `purchase ${i} failed`).toBeUndefined();
    }
    expect(world.charters[id].branches.filter((b) => b.alive)).toHaveLength(10);

    world = tick(world, 86_400);
    world = buyLicense(world, id);
    expect(world.lastError).toBe("max_branches");
  });
});
