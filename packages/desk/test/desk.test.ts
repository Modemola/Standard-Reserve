import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  applySwap,
  buyLicense,
  createWorld,
  quoteLicensePrice,
  quoteRetirement,
  seedGenesis,
  tick,
} from "@standard-law/engine";
import type { World } from "@standard-law/engine";
import { charterBoard } from "../src/charterBoard.js";
import { exitImpact, feeRateWithCrowd } from "../src/exitImpact.js";
import { flipQuote } from "../src/flip.js";
import { licensePlans, secondsUntilFloor } from "../src/licensePlans.js";
import { poolPrints, poolTape } from "../src/poolTape.js";

function seeded(charters = 20): World {
  return seedGenesis(createWorld(DEFAULT_PARAMS, 0), charters);
}

describe("flipQuote", () => {
  it("asks for nothing when the epoch is already pointing at expansion", () => {
    const w = applySwap(seeded(), "buyStd", 5n * 10n ** 18n);
    const q = flipQuote(w);
    expect(q.Fn).toBeGreaterThan(0n);
    expect(q.ethToFlipToExpansion).toBe(0n);
    expect(q.ethToFlipToContraction).toBe(q.Fn);
    expect(q.regimeIfEpochEndedNow).toBe("expansion");
  });

  it("needs strictly positive net to flip out of contraction, so zero costs one wei", () => {
    const w = seeded();
    const q = flipQuote(w);
    expect(q.Fn).toBe(0n);
    expect(q.regimeIfEpochEndedNow).toBe("contraction");
    expect(q.ethToFlipToExpansion).toBe(1n);
    expect(q.ethToFlipToContraction).toBe(0n);
  });

  it("matches ethInEpoch - ethOutEpoch exactly", () => {
    let w = seeded();
    w = applySwap(w, "buyStd", 3n * 10n ** 18n);
    w = applySwap(w, "sellStd", 500_000n * 10n ** 18n);
    expect(flipQuote(w).Fn).toBe(w.ethInEpoch - w.ethOutEpoch);
  });
});

describe("charterBoard", () => {
  it("reports a closed book when the daily cap is zero, with no price at all", () => {
    const board = charterBoard(seeded());
    expect(DEFAULT_PARAMS.charterDailyCap).toBe(0);
    expect(board.open).toBe(false);
    expect(board.pNow).toBeUndefined();
    expect(board.pFloor).toBeUndefined();
  });

  it("opens and quotes once the cap is lifted", () => {
    const w = seeded();
    const opened: World = {
      ...w,
      params: { ...w.params, charterDailyCap: 5 },
      charterAuction: { ...w.charterAuction, cap: 5 },
    };
    const board = charterBoard(opened);
    expect(board.open).toBe(true);
    expect(board.cap).toBe(5);
    expect(board.pNow).toBeGreaterThan(0n);
  });
});

describe("licensePlans", () => {
  it("always returns exactly three rows: now, wait, floor", () => {
    const rows = licensePlans(seeded(), "c-0001");
    expect(rows.map((r) => r.kind)).toEqual(["now", "wait", "floor"]);
  });

  it("prices the now row at the live auction quote and decays with the wait", () => {
    const w = seeded();
    const rows = licensePlans(w, "c-0001");
    expect(rows[0].P).toBe(quoteLicensePrice(w));
    expect(rows[1].P).toBeLessThan(rows[0].P);
    expect(rows[2].P).toBeLessThanOrEqual(rows[1].P);
  });

  it("lands the floor row within floorEpsilon of the floor", () => {
    const w = seeded();
    const floorRow = licensePlans(w, "c-0001")[2];
    const band =
      (w.licenseAuction.pFloor * BigInt(Math.round((1 + w.params.floorEpsilon) * 1e6))) / 1_000_000n;
    expect(floorRow.P).toBeLessThanOrEqual(band);
    expect(secondsUntilFloor(w)).toBeGreaterThan(0);
  });

  it("marks the plan unavailable, with the engine's own reason, when the rack is full", () => {
    let w = seeded();
    // Fill c-0001 to its ten branches: three a day for three days.
    for (let day = 0; day < 3; day++) {
      for (let i = 0; i < 3; i++) w = buyLicense(w, "c-0001");
      w = tick(w, 86_400);
    }
    const rows = licensePlans(w, "c-0001");
    expect(rows.every((r) => !r.available)).toBe(true);
    expect(rows[0].reason).toBe("max_branches");
  });

  it("does not interpolate a fill once the day is sold out", () => {
    let w = seeded(200);
    const ids = Object.keys(w.charters);
    // Exhaust the day's licensesPerDay across many charters.
    for (const id of ids) {
      if (w.licenseAuction.sold >= w.licenseAuction.cap) break;
      w = buyLicense(w, id);
    }
    expect(w.licenseAuction.sold).toBe(w.licenseAuction.cap);

    const rows = licensePlans(w, "c-0001");
    expect(rows[0].available).toBe(false);
    expect(rows[0].reason).toBe("daily_cap_reached");
    // The floor row stays inside the same day, so it cannot invent inventory.
    expect(rows[2].available).toBe(false);
  });
});

describe("exitImpact", () => {
  it("splits the fee into burn plus rebate and flags the last branch", () => {
    let w = seeded();
    w = tick(w, 2 * DEFAULT_PARAMS.epochSeconds);

    const single = exitImpact(w, "c-0001", 0)!;
    expect(single.lastBranch).toBe(true);
    expect(single.rebate).toBe(0n); // nobody left to rebate to
    expect(single.burn).toBeGreaterThan(0n);
    expect(single.mintToUser).toBeGreaterThan(0n);

    let multi = buyLicense(w, "c-0002");
    multi = tick(multi, 3600);
    const shared = exitImpact(multi, "c-0002", 0)!;
    const quote = quoteRetirement(multi, "c-0002", 0)!;
    expect(shared.lastBranch).toBe(false);
    expect(shared.rebate).toBeGreaterThan(0n);
    // The whole fee is accounted for: half burns, half goes to the stayers.
    expect(shared.burn + shared.rebate).toBe(quote.fee);
    expect(shared.mintToUser + quote.fee).toBe(quote.ledger);
  });

  it("raises the quoted rate as the door gets busier, without touching the live world", () => {
    let w = tick(seeded(), 2 * DEFAULT_PARAMS.epochSeconds);
    const before = JSON.stringify(w.withdrawWindow);

    const quiet = exitImpact(w, "c-0001", 0, 0)!;
    const crowded = exitImpact(w, "c-0001", 0, 40, 10_000n * 10n ** 18n)!;

    expect(crowded.feeRateIfRetireLvl).toBeGreaterThan(quiet.feeRateNow);
    expect(crowded.feeRateIfRetireLvl).toBeLessThanOrEqual(DEFAULT_PARAMS.feeCeil);
    expect(JSON.stringify(w.withdrawWindow)).toBe(before);
  });

  it("is null for a branch that is not there", () => {
    expect(exitImpact(seeded(), "c-0001", 7)).toBeNull();
    expect(exitImpact(seeded(), "nope", 0)).toBeNull();
  });

  it("feeRateWithCrowd is monotone in the number of exits", () => {
    const w = tick(seeded(), 2 * DEFAULT_PARAMS.epochSeconds);
    const std = 1_000n * 10n ** 18n;
    let prev = feeRateWithCrowd(w, 0, std);
    for (const n of [1, 5, 20, 100]) {
      const rate = feeRateWithCrowd(w, n, std);
      expect(rate).toBeGreaterThanOrEqual(prev);
      prev = rate;
    }
  });
});

describe("poolTape", () => {
  it("returns the last N rows and can filter to pool prints", () => {
    const rows = [
      { t: 1, op: "buyStd", ethIn: "1", Fn: "1" },
      { t: 2, op: "checkIn", Fn: "1" },
      { t: 3, op: "sellStd", ethOut: "2", Fn: "-1" },
    ];
    expect(poolTape(rows, 2).map((r) => r.t)).toEqual([2, 3]);
    expect(poolPrints(rows).map((r) => r.op)).toEqual(["buyStd", "sellStd"]);
  });
});
