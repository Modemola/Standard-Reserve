import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { buyLicense, createWorld, seedGenesis } from "../src/index.js";

describe("license auction", () => {
  it("burns 100% of the license payment and rejects a 4th same-day purchase", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];
    const bBefore = world.B;

    for (let i = 0; i < 3; i++) {
      world = buyLicense(world, id);
      expect(world.lastError, `purchase ${i} failed`).toBeUndefined();
    }
    expect(world.B).toBeGreaterThan(bBefore);

    world = buyLicense(world, id);
    expect(world.lastError).toBe("per_charter_daily_cap");
  });
});
