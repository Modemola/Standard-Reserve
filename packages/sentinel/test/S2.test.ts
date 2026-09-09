// Claims the P1/P2 fixtures make in prose but can only assert coarsely from
// JSON. These pin the mechanism itself.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  ISSUANCE_BUDGET,
  buyLicense,
  createWorld,
  quoteRetirement,
  reportDormant,
  retireBranch,
  seedGenesis,
  tick,
} from "@standard-law/engine";
import { loadFixtures } from "../src/runAll.js";
import { runAttack } from "../src/runAttack.js";

const byId = (id: string) => loadFixtures().find((f) => f.id === id)!;

describe("A9 self-rebate", () => {
  it("pays the rebate to the branches that stayed, never to the one leaving", () => {
    let w = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 10);
    w = buyLicense(w, "c-0001");
    w = buyLicense(w, "c-0001");
    w = tick(w, 2 * DEFAULT_PARAMS.epochSeconds);

    const quote = quoteRetirement(w, "c-0001", 0)!;
    expect(quote.fee).toBeGreaterThan(0n);
    const before = w.charters["c-0001"].branches.map((b) => b.ledger);

    w = retireBranch(w, "c-0001", 0);
    const after = w.charters["c-0001"].branches.map((b) => b.ledger);

    // The retired slot keeps nothing.
    expect(after[0]).toBe(0n);
    expect(w.charters["c-0001"].branches[0].alive).toBe(false);
    // The stayers each gained, and together they got the whole rebate half.
    expect(after[1]).toBeGreaterThan(before[1]);
    expect(after[2]).toBeGreaterThan(before[2]);
    const rebated = after[1] - before[1] + (after[2] - before[2]);
    expect(rebated).toBe(quote.fee - quote.fee / 2n);
  });
});

describe("A13 issuance budget", () => {
  it("actually runs the budget dry rather than passing under it", () => {
    const v = runAttack(byId("A13_issuance_budget"));
    expect(v.status).toBe("held");

    // Rebuild far enough to read the counter itself.
    const f = byId("A13_issuance_budget");
    expect(f.paramsOverlay.baseDailyStd).toBeDefined();
    let w = seedGenesis(
      createWorld({ ...DEFAULT_PARAMS, baseDailyStd: BigInt(String(f.paramsOverlay.baseDailyStd)) }, 0),
      50,
    );
    w = tick(w, 12 * DEFAULT_PARAMS.epochSeconds);
    expect(w.issuanceCreditsCum).toBe(ISSUANCE_BUDGET);

    const after = tick(w, DEFAULT_PARAMS.epochSeconds);
    expect(after.issuanceCreditsCum).toBe(ISSUANCE_BUDGET);
  });
});

describe("A6 licence caps", () => {
  it("rejects the fourth purchase of a day but allows the first of the next", () => {
    let w = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 10);
    for (let i = 0; i < 3; i++) {
      w = buyLicense(w, "c-0001");
      expect(w.lastError).toBeUndefined();
    }
    w = buyLicense(w, "c-0001");
    expect(w.lastError).toBe("per_charter_daily_cap");

    w = tick(w, 86_400);
    w = buyLicense(w, "c-0001");
    expect(w.lastError).toBeUndefined();
  });

  it("stops the rack at maxBranches", () => {
    const v = runAttack(byId("A6_license_sniper"));
    expect(v.status).toBe("held");
    expect(v.after.N).toBeGreaterThan(v.before.N); // licences really were bought
  });
});

describe("A10 dormancy revocation", () => {
  it("caps the reporter bounty and takes the charter down", () => {
    let w = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 10);
    w = tick(w, DEFAULT_PARAMS.dormancySeconds + 3600);
    const mBefore = w.M;

    w = reportDormant(w, "c-0001", "griefer");
    expect(w.lastError).toBeUndefined();
    expect(w.charters["c-0001"].alive).toBe(false);
    // Ledger over 30 days dwarfs the cap, so the bounty lands exactly on it.
    expect(w.M - mBefore).toBe(DEFAULT_PARAMS.dormancyBountyCapStd);
  });
});
