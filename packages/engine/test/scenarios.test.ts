import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_RAW_PARAMS, loadParamsWithOverlay } from "@standard-law/params";
import { SimStore, hashWorld, invariantCheck } from "../src/index.js";
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
});
