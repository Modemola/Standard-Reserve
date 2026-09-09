import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  applySwap,
  contractionSpend,
  createTrace,
  createWorld,
  seedGenesis,
  tick,
} from "@standard-law/engine";
import { loadFixtures } from "../src/runAll.js";
import { runFixture, solveSellForEthOut } from "../src/runFixture.js";

const fixture = () => loadFixtures().find((f) => f.id === "A4_contraction_bait")!;

/** Rebuild the fixture's world with a trace attached so we can audit each hour. */
function baitedWorld() {
  let w = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 50);
  const trace = createTrace();
  w = applySwap(w, "buyStd", 20n * 10n ** 18n);
  const sell = solveSellForEthOut(w.pool, w.params.poolFeeBps, 25n * 10n ** 18n);
  w = applySwap(w, "sellStd", sell);
  w = tick(w, DEFAULT_PARAMS.epochSeconds, trace); // contraction close funds the vault
  w = tick(w, DEFAULT_PARAMS.epochSeconds, trace); // a day of hourly buybacks
  return { w, trace };
}

describe("A4 contraction bait", () => {
  it("holds: the vault drains on a leash", () => {
    const v = runFixture(fixture());
    expect(v.status, JSON.stringify([...v.broken, ...v.unexpected])).toBe("held");
  });

  it("the vault was really funded and buybacks really ran", () => {
    const { trace } = baitedWorld();
    expect(trace.buybacks.length).toBeGreaterThanOrEqual(24);
    expect(trace.buybacks.some((b) => b.spend > 0n)).toBe(true);
  });

  it("every recorded hour spends exactly min(10% vault, 0.2% pool)", () => {
    const { trace } = baitedWorld();
    for (const b of trace.buybacks) {
      expect(b.spend).toBe(contractionSpend(b.vaultBefore, b.poolEthBefore));
      expect(b.spend * 10n).toBeLessThanOrEqual(b.vaultBefore);
      expect(b.spend * 1000n).toBeLessThanOrEqual(b.poolEthBefore * 2n);
    }
  });

  it("never sells gold to fund a buyback", () => {
    const { w } = baitedWorld();
    expect(w.vaults.expansionGold).toBe(0n);
    const v = runFixture(fixture());
    expect(BigInt(v.after.expansionGold)).toBeGreaterThanOrEqual(BigInt(v.before.expansionGold));
  });
});
