import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { buyLicense, createWorld, retireBranch, seedGenesis, tick } from "../src/index.js";

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

  it("conserves the retired branch's full ledger across mint + burn + rebate (no dust loss)", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];
    world = buyLicense(world, id); // opens branch 1 alongside genesis branch 0

    // Contrive a ledger/fee that does not divide evenly across the other
    // live branches, so any truncated remainder is forced to show up:
    // feeRate collapses to feeFloor (1%) since D+W << exitDenomMin, so
    // fee = 200 * 1% = 2, half-fee = 1, and the 1-wei rebate remainder
    // split across 2 other branches truncates to 0 per branch unless the
    // remainder is explicitly credited somewhere.
    world.charters[id].branches[0].ledger = 200n;
    world = buyLicense(world, id); // opens branch 2 (ledger 0) so there are 2 "other" branches
    const otherIds = world.charters[id].branches.filter((b) => b.alive && b.id !== 0).map((b) => b.id);
    expect(otherIds).toEqual([1, 2]);

    const ledgerById = new Map(world.charters[id].branches.map((b) => [b.id, b.ledger]));
    const ledgerRetired = world.charters[id].branches[0].ledger;
    const mBefore = world.M;
    const bBefore = world.B;

    world = retireBranch(world, id, 0);
    expect(world.lastError).toBeUndefined();

    const mDelta = world.M - mBefore;
    const bDelta = world.B - bBefore;
    const rebateDelta = world.charters[id].branches
      .filter((b) => b.alive)
      .reduce((sum, b) => sum + (b.ledger - (ledgerById.get(b.id) ?? 0n)), 0n);

    expect(mDelta + bDelta + rebateDelta).toBe(ledgerRetired);
  });
});
