import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { createWorld, retireBranch, seedGenesis, tick } from "../src/index.js";

describe("branch retirement", () => {
  it("retiring the last live branch burns the charter", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];
    world = tick(world, 3600); // accrue some ledger

    world = retireBranch(world, id, 0);
    expect(world.lastError).toBeUndefined();
    expect(world.charters[id].alive).toBe(false);
    expect(world.charters[id].branches[0].alive).toBe(false);
  });

  it("mints ledger-minus-fee to the user and burns half the fee", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];
    world = tick(world, 7200);
    const ledger = world.charters[id].branches[0].ledger;
    const mBefore = world.M;
    const bBefore = world.B;

    world = retireBranch(world, id, 0);
    expect(world.lastError).toBeUndefined();
    expect(world.M - mBefore).toBeLessThan(ledger);
    expect(world.M - mBefore).toBeGreaterThan(0n);
    expect(world.B).toBeGreaterThan(bBefore);
  });
});
