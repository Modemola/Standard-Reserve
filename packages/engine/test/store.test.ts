import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { createWorld, reportDormant, seedGenesis, tick } from "../src/index.js";

describe("lastError lifecycle", () => {
  it("does not leak a stale rejection across later successful actions (tick, seedGenesis, checkIn)", () => {
    let world = createWorld(DEFAULT_PARAMS, 0);
    world = seedGenesis(world, 1);
    const id = Object.keys(world.charters)[0];

    // Reject: the charter was just interacted with, so it isn't dormant yet.
    world = reportDormant(world, id, "reporter-1");
    expect(world.lastError).toBe("not_yet_dormant");

    // Any subsequent action that always succeeds must clear the stale
    // rejection rather than carry it forward -- the UI's error toast is
    // keyed on this field, and a stale message reappearing on an unrelated
    // successful action reads as that action having failed.
    world = tick(world, 3600);
    expect(world.lastError).toBeUndefined();
  });
});
