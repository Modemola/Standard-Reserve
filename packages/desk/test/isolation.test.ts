// §11 — "cockpit what-if and desk clone do not share object references
// (mutate clone, live unchanged)". Every Desk quote is a read, and every
// engine action deep-clones, so a solver can never reach back into live state.
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, applySwap, createWorld, seedGenesis, tick } from "@standard-law/engine";
import type { World } from "@standard-law/engine";
import { charterBoard } from "../src/charterBoard.js";
import { exitImpact, feeRateWithCrowd } from "../src/exitImpact.js";
import { flipQuote } from "../src/flip.js";
import { licensePlans } from "../src/licensePlans.js";

function seeded(): World {
  return tick(seedGenesis(createWorld(DEFAULT_PARAMS, 0), 20), 2 * DEFAULT_PARAMS.epochSeconds);
}

const stringify = (w: World) =>
  JSON.stringify(w, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

describe("clone isolation", () => {
  it("running every Desk quote leaves the live world byte-identical", () => {
    const live = seeded();
    const before = stringify(live);

    flipQuote(live);
    charterBoard(live);
    licensePlans(live, "c-0001");
    exitImpact(live, "c-0001", 0, 40, 5_000n * 10n ** 18n);
    feeRateWithCrowd(live, 75, 9_000n * 10n ** 18n);

    expect(stringify(live)).toBe(before);
  });

  it("an engine action shares no nested references with the world it was given", () => {
    const live = seeded();
    const next = applySwap(live, "buyStd", 10n ** 18n);

    expect(next).not.toBe(live);
    expect(next.pool).not.toBe(live.pool);
    expect(next.vaults).not.toBe(live.vaults);
    expect(next.charters).not.toBe(live.charters);
    expect(next.charters["c-0001"]).not.toBe(live.charters["c-0001"]);
    expect(next.charters["c-0001"].branches).not.toBe(live.charters["c-0001"].branches);
    expect(next.charters["c-0001"].branches[0]).not.toBe(live.charters["c-0001"].branches[0]);
    expect(next.withdrawWindow).not.toBe(live.withdrawWindow);
    expect(next.F).not.toBe(live.F);
    expect(next.licenseAuction).not.toBe(live.licenseAuction);
  });

  it("mutating a what-if clone as deeply as possible leaves live state alone", () => {
    const live = seeded();
    const liveBefore = stringify(live);
    const draft = applySwap(live, "buyStd", 10n ** 18n);

    // The cockpit's what-if drawer edits its clone freely before committing.
    draft.pool.eth = 1n;
    draft.vaults.contractionEth = 123n;
    draft.charters["c-0001"].branches[0].ledger = 999n;
    draft.charters["c-0001"].alive = false;
    draft.withdrawWindow.push({ ts: 1, amount: 1n });
    draft.F.push(-1n);

    expect(stringify(live)).toBe(liveBefore);
  });
});
