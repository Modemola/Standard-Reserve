import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import {
  GENESIS_POL,
  applySwap,
  buyLicense,
  checkIn,
  createWorld,
  reportDormant,
  retireBranch,
  seedGenesis,
  supplyCirc,
  supplyMax,
  tick,
} from "../src/index.js";
import type { World } from "../src/index.js";

/**
 * Property tests over randomised op sequences.
 *
 * The Solidity twin got 20k fuzz runs and that found two real bugs; the TS
 * engine — far larger, and the thing that actually ships — had only
 * example-based tests. Seeded PRNG so a failure is reproducible.
 */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const RUNS = 60;
const OPS_PER_RUN = 40;

function randomWalk(seed: number, onStep: (w: World, prev: World, op: string) => void): World {
  const rng = makeRng(seed);
  let world = createWorld(DEFAULT_PARAMS, 0);
  world = seedGenesis(world, 3);
  const ids = Object.keys(world.charters);

  for (let i = 0; i < OPS_PER_RUN; i++) {
    const prev = world;
    const roll = rng();
    let op: string;

    if (roll < 0.25) {
      op = "buyStd";
      world = applySwap(world, "buyStd", BigInt(Math.floor(rng() * 5e18) + 1));
    } else if (roll < 0.5) {
      op = "sellStd";
      world = applySwap(world, "sellStd", BigInt(Math.floor(rng() * 5e21) + 1));
    } else if (roll < 0.7) {
      op = "tick";
      world = tick(world, Math.floor(rng() * 200_000) + 1);
    } else if (roll < 0.8) {
      op = "buyLicense";
      world = buyLicense(world, ids[Math.floor(rng() * ids.length)]);
    } else if (roll < 0.88) {
      op = "retireBranch";
      world = retireBranch(world, ids[Math.floor(rng() * ids.length)], Math.floor(rng() * 3));
    } else if (roll < 0.94) {
      op = "checkIn";
      world = checkIn(world, ids[Math.floor(rng() * ids.length)]);
    } else {
      op = "reportDormant";
      world = reportDormant(world, ids[Math.floor(rng() * ids.length)], "reporter");
    }

    onStep(world, prev, op);
  }
  return world;
}

describe("engine properties over random op sequences", () => {
  it("holds the supply identity S_circ = GENESIS_POL + M - B after every op", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      randomWalk(seed, (w) => {
        expect(supplyCirc(w)).toBe(GENESIS_POL + w.M - w.B);
      });
    }
  });

  it("never lets S_max increase", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      randomWalk(seed, (w, prev) => {
        expect(supplyMax(w) <= supplyMax(prev)).toBe(true);
      });
    }
  });

  it("never lets protocol-owned liquidity decrease", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      randomWalk(seed, (w, prev) => {
        expect(w.polEth >= prev.polEth).toBe(true);
        expect(w.polStd >= prev.polStd).toBe(true);
      });
    }
  });

  it("never produces a negative balance anywhere", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      randomWalk(seed, (w) => {
        expect(w.M >= 0n && w.B >= 0n).toBe(true);
        expect(w.pool.eth > 0n && w.pool.std > 0n).toBe(true);
        expect(w.vaults.expansionEth >= 0n && w.vaults.contractionEth >= 0n).toBe(true);
        expect(w.teamEth >= 0n && w.feeBucketEth >= 0n).toBe(true);
        for (const c of Object.values(w.charters)) {
          for (const b of c.branches) expect(b.ledger >= 0n).toBe(true);
        }
      });
    }
  });

  it("keeps invariantCheck green throughout", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      randomWalk(seed, (w) => {
        expect(w.invariantsOk).toBe(true);
      });
    }
  });

  it("never lets the pool's constant product decrease across a swap", () => {
    // Rounding must favour the pool, not the trader. floor() in the wrong
    // direction lets k erode a little on every trade.
    for (let seed = 1; seed <= RUNS; seed++) {
      randomWalk(seed, (w, prev, op) => {
        if (op !== "buyStd" && op !== "sellStd") return;
        expect(w.pool.eth * w.pool.std >= prev.pool.eth * prev.pool.std).toBe(true);
      });
    }
  });

  it("advances the full requested duration on an ordinary tick", () => {
    const world = createWorld(DEFAULT_PARAMS, 0);
    const oneYear = 365 * 86_400;
    const after = tick(world, oneYear);
    expect(after.now).toBe(world.now + oneYear);
    expect(after.lastError).toBeUndefined();
  });

  it("never advances less time than asked for without saying so", () => {
    // The loop is bounded by MAX_TICK_STEPS so a hostile dt cannot hang the
    // tab. Truncating is acceptable; truncating in silence is not, because
    // every downstream number would then describe a world that never
    // reached the requested instant.
    const world = createWorld(DEFAULT_PARAMS, 0);
    const twentyYears = 20 * 365 * 86_400;
    const after = tick(world, twentyYears);

    const advancedFully = after.now === world.now + twentyYears;
    expect(advancedFully || after.lastError === "tick_truncated").toBe(true);
  });
});
