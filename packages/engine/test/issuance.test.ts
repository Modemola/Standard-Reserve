import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { createWorld, seedGenesis, tick } from "../src/index.js";
import { streamIssuance } from "../src/issuance.js";
import { ISSUANCE_BUDGET } from "../src/constants.js";

describe("issuance", () => {
  it("never lets issuanceCreditsCum exceed ISSUANCE_BUDGET", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    world = { ...world, issuanceCreditsCum: ISSUANCE_BUDGET - 10n };

    world = tick(world, 3600);
    expect(world.issuanceCreditsCum).toBe(ISSUANCE_BUDGET);

    world = tick(world, 3600);
    expect(world.issuanceCreditsCum).toBe(ISSUANCE_BUDGET);
  });

  it("streamIssuance is a no-op once the budget is exhausted", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    world = { ...world, issuanceCreditsCum: ISSUANCE_BUDGET };
    const id = Object.keys(world.charters)[0];
    const ledgerBefore = world.charters[id].branches[0].ledger;

    streamIssuance(world, 3600);
    expect(world.charters[id].branches[0].ledger).toBe(ledgerBefore);
  });

  it("m active during an epoch is not affected by that epoch's own F_n", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const mAtEpochStart = world.m;

    // A large outflow mid-epoch changes ethOutEpoch but must not retroactively
    // change m (and therefore issuance) until the epoch actually closes.
    world = tick(world, Math.floor(DEFAULT_PARAMS.epochSeconds / 2));
    expect(world.m).toBe(mAtEpochStart);
    expect(world.epoch).toBe(0);
  });
});
