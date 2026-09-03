import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { buyCharter, buyLicense, createWorld, seedGenesis, tick } from "../src/index.js";

describe("auction daily rollover pricing (WP §4.5)", () => {
  it("license reopens at 2x the prior day's clearing price", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];

    world = buyLicense(world, id);
    expect(world.lastError).toBeUndefined();
    const pLastDay0 = world.licenseAuction.pLast;

    world = tick(world, 86_400); // cross into day 1, rolling the auction
    expect(world.licenseAuction.pStart).toBe(pLastDay0 * 2n);
  });

  it("charter reopens at 3x the prior day's clearing price, not 2x", () => {
    let world = createWorld({ ...DEFAULT_PARAMS, charterDailyCap: 5 }, 0);

    world = buyCharter(world, "owner-1", world.charterAuction.pStart);
    expect(world.lastError).toBeUndefined();
    const pLastDay0 = world.charterAuction.pLast;

    world = tick(world, 86_400); // cross into day 1, rolling the auction
    expect(world.charterAuction.pStart).toBe(pLastDay0 * 3n);
  });

  it("prices each new day's license floor off the m that was just updated at that epoch close", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1); // N=1 live branch throughout, isolating the m effect

    // Day 0 -> day 1: F_n <= 0 both epochs, so m cuts every close. Two
    // consecutive daily rollovers give two floors whose ratio should track
    // the ratio of the *new* m each time was set to, not the prior day's.
    world = tick(world, 86_400);
    const mAfterFirstCut = world.m;
    const floorAfterFirstCut = world.licenseAuction.pFloor;

    world = tick(world, 86_400);
    const mAfterSecondCut = world.m;
    const floorAfterSecondCut = world.licenseAuction.pFloor;

    expect(mAfterSecondCut).toBeLessThan(mAfterFirstCut);
    expect(floorAfterSecondCut).toBeLessThan(floorAfterFirstCut);
    const ratio = Number(floorAfterSecondCut) / Number(floorAfterFirstCut);
    expect(ratio).toBeCloseTo(mAfterSecondCut / mAfterFirstCut, 2);
  });
});
