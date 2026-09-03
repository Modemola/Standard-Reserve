import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { createWorld, reportDormant, seedGenesis, tick } from "../src/index.js";

describe("dormancy", () => {
  it("rejects a report before the dormancy window elapses", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];

    world = reportDormant(world, id, "reporter-1");
    expect(world.lastError).toBe("not_yet_dormant");
    expect(world.charters[id].alive).toBe(true);
  });

  it("revokes the charter after the dormancy window, capping the reporter bounty", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];
    world = tick(world, DEFAULT_PARAMS.dormancySeconds + 3600);
    const mBefore = world.M;

    world = reportDormant(world, id, "reporter-1");
    expect(world.lastError).toBeUndefined();
    expect(world.charters[id].alive).toBe(false);
    // Accrued ledger over 30 days at full issuance dwarfs the bounty cap.
    expect(world.M - mBefore).toBe(DEFAULT_PARAMS.dormancyBountyCapStd);
  });

  it("bounty is dormancyBountyBps of the fee (capped), not a hardcoded 50/50 split", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    // Dilute issuance across the max genesis charter count so accrued ledger
    // per branch stays well under the bounty cap after 30 days.
    world = seedGenesis(world, DEFAULT_PARAMS.genesisCharterCap);
    const id = Object.keys(world.charters)[0];
    world = tick(world, DEFAULT_PARAMS.dormancySeconds + 3600);

    const ledger = world.charters[id].branches[0].ledger;
    const fee = (ledger * BigInt(DEFAULT_PARAMS.revocationBps)) / 10_000n;
    const expectedBounty = (fee * BigInt(DEFAULT_PARAMS.dormancyBountyBps)) / 10_000n;
    // Sanity check: this test only proves the point if we're under the cap.
    expect(expectedBounty).toBeLessThan(DEFAULT_PARAMS.dormancyBountyCapStd);

    const mBefore = world.M;
    const bBefore = world.B;
    world = reportDormant(world, id, "reporter-1");
    expect(world.lastError).toBeUndefined();

    expect(world.M - mBefore).toBe(expectedBounty);
    expect(world.B - bBefore).toBe(fee - expectedBounty);
  });
});
