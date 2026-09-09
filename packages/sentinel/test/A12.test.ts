import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  applySwap,
  buyLicense,
  createWorld,
  retireBranch,
  seedGenesis,
  tick,
} from "@standard-law/engine";
import type { World } from "@standard-law/engine";
import { loadFixtures } from "../src/runAll.js";
import { runAttack } from "../src/runAttack.js";

const fixture = () => loadFixtures().find((f) => f.id === "A12_pol_rug")!;

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("A12 POL rug", () => {
  it("holds: the scripted path never pulls POL down", () => {
    const v = runAttack(fixture());
    expect(v.status, JSON.stringify([...v.broken, ...v.unexpected])).toBe("held");
  });

  it("the scripted path actually grows POL — the pass is not vacuous", () => {
    const v = runAttack(fixture());
    expect(BigInt(v.after.polEth)).toBeGreaterThan(BigInt(v.before.polEth));
    expect(BigInt(v.after.polStd)).toBeGreaterThan(BigInt(v.before.polStd));
  });

  it("100 random ops never move either POL leg down", () => {
    let w: World = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 20);
    const rand = lcg(7);
    let prevEth = w.polEth;
    let prevStd = w.polStd;
    const ids = Object.keys(w.charters);

    for (let i = 0; i < 100; i++) {
      const roll = rand();
      if (roll < 0.35) {
        w = applySwap(w, "buyStd", BigInt(Math.floor(rand() * 5e18) + 1));
      } else if (roll < 0.7) {
        w = applySwap(w, "sellStd", BigInt(Math.floor(rand() * 5e21) + 1));
      } else if (roll < 0.8) {
        w = buyLicense(w, ids[Math.floor(rand() * ids.length)]);
      } else if (roll < 0.88) {
        const id = ids[Math.floor(rand() * ids.length)];
        const branch = w.charters[id]?.branches.find((b) => b.alive);
        if (branch) w = retireBranch(w, id, branch.id);
      } else {
        w = tick(w, Math.floor(rand() * 90_000) + 3600);
      }

      expect(w.polEth).toBeGreaterThanOrEqual(prevEth);
      expect(w.polStd).toBeGreaterThanOrEqual(prevStd);
      prevEth = w.polEth;
      prevStd = w.polStd;
    }

    // The run has to have exercised the POL path at all.
    expect(prevEth).toBeGreaterThan(0n);
  });
});
