import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_RAW_PARAMS, loadParamsWithOverlay } from "@standard-law/params";
import { SCENARIO_OPS, SimStore, hashWorld, invariantCheck } from "../src/index.js";
import type { Scenario } from "../src/types.js";

const scenariosDir = join(dirname(fileURLToPath(import.meta.url)), "../../../scenarios");
const files = readdirSync(scenariosDir).filter((f) => f.endsWith(".json"));

describe("bundled scenarios", () => {
  it("ships at least the five required bundles", () => {
    const ids = files.map((f) => f.replace(/\.json$/, ""));
    for (const required of [
      "inflow_week",
      "exodus",
      "wash_same_epoch",
      "license_mania",
      "ghost_purge",
    ]) {
      expect(ids).toContain(required);
    }
  });

  for (const file of files) {
    it(`${file} uses only ops the replayer knows`, () => {
      // Without this, a typo'd op is skipped in silence: invariants still
      // hold and the replay still hashes deterministically, so the checks
      // below would happily pass a scenario that teaches nothing.
      const scenario = JSON.parse(readFileSync(join(scenariosDir, file), "utf8")) as Scenario;
      const ops = scenario.actions.map((a) => a.op);
      for (const op of ops) expect(SCENARIO_OPS).toContain(op);
    });
  }

  for (const file of files) {
    it(`${file} replays without breaking invariants and hashes deterministically`, () => {
      const scenario = JSON.parse(readFileSync(join(scenariosDir, file), "utf8")) as Scenario;
      const params = loadParamsWithOverlay(DEFAULT_RAW_PARAMS, scenario.paramsOverlay ?? {});

      const storeA = new SimStore(null as never);
      storeA.loadScenario(scenario, params);
      const storeB = new SimStore(null as never);
      storeB.loadScenario(scenario, params);

      const inv = invariantCheck(storeA.world);
      expect(inv.ok, JSON.stringify(inv.failures)).toBe(true);
      expect(hashWorld(storeA.world)).toBe(hashWorld(storeB.world));
    });
  }

  it("wash_same_epoch really nets to zero, so it teaches what it claims", () => {
    // The sell was a hand-estimated round number that pulled 0.99385 ETH back
    // out against 1 ETH in. F_n closed at +0.0061, so the epoch closed
    // *expansion* and m was never cut -- the opposite of the scenario's own
    // teaching point, and visible on the /scenarios card as "ends in
    // expansion, m lands at 1.00" next to a description saying contraction.
    const scenario = JSON.parse(
      readFileSync(join(scenariosDir, "wash_same_epoch.json"), "utf8"),
    ) as Scenario;
    const params = loadParamsWithOverlay(DEFAULT_RAW_PARAMS, scenario.paramsOverlay ?? {});

    const store = new SimStore(null as never);
    store.loadScenario(scenario, params);
    const world = store.world;

    // The epoch it ran in closed on exactly zero net flow...
    expect(world.F.length).toBeGreaterThan(0);
    expect(world.F[world.F.length - 1]).toBe(0n);
    // ...which is contraction, and takes the cut.
    expect(world.m).toBeLessThan(params.mLaunch);
  });
});
