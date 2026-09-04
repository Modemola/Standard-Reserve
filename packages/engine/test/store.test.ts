import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { SimStore, createWorld, reportDormant, seedGenesis, tick } from "../src/index.js";
import type { Scenario } from "../src/index.js";

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

  it("does not carry a scenario's scripted rejection out of loadScenario", () => {
    // Mirrors scenarios/ghost_purge.json: the charter checks in, so its
    // later dormancy report is *meant* to be rejected. That is the lesson,
    // not a load failure, and it must not surface as an error to the user.
    const scenario: Scenario = {
      id: "scripted-rejection",
      title: "scripted rejection",
      teach: "checking in protects a charter from being reported dormant",
      paramsOverlay: {},
      actions: [
        { t: 0, op: "seedGenesis", count: 2 },
        { t: 0, op: "tick", dt: DEFAULT_PARAMS.dormancySeconds },
        { t: DEFAULT_PARAMS.dormancySeconds, op: "checkIn", charterId: "c-0001" },
        { t: DEFAULT_PARAMS.dormancySeconds, op: "tick", dt: 3600 },
        {
          t: DEFAULT_PARAMS.dormancySeconds + 3600,
          op: "reportDormant",
          charterId: "c-0001",
          reporterKey: "reporter-1",
        },
      ],
    } as unknown as Scenario;

    const store = new SimStore(createWorld(DEFAULT_PARAMS, 0));
    store.loadScenario(scenario, DEFAULT_PARAMS);

    // The rejection still happened — c-0001 survived because it checked in.
    expect(store.world.charters["c-0001"].alive).toBe(true);
    expect(store.world.lastError).toBeUndefined();
  });
});
