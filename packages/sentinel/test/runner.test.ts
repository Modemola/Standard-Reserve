// The harness itself. A verdict table nobody has ever seen go red is not
// evidence of anything, so these tests deliberately break fixtures and assert
// that Sentinel notices — and that a yellow finding never fails CI.
import { describe, expect, it } from "vitest";
import { loadFixtures } from "../src/runAll.js";
import { runFixture } from "../src/runFixture.js";
import { reportMarkdown, shouldFail } from "../src/report.js";
import type { AttackFixture } from "../src/schema.js";

const byId = (id: string): AttackFixture => loadFixtures().find((f) => f.id === id)!;

describe("verdict routing", () => {
  it("reports broken when an invariant fixture misses its expectation", () => {
    const f = byId("A1_wash_volume");
    const rigged: AttackFixture = {
      ...f,
      expect: { ...f.expect, regimeAfter: "expansion" },
    };
    const v = runFixture(rigged);
    expect(v.status).toBe("broken");
    expect(v.unexpected.join(" ")).toContain("regimeAfter");
  });

  it("catches a violated per-tick buyback bound", () => {
    const f = byId("A4_contraction_bait");
    const rigged: AttackFixture = {
      ...f,
      expect: { ...f.expect, maxSpendFractionOfVaultPerTick: 0.0001 },
    };
    const v = runFixture(rigged);
    expect(v.status).toBe("broken");
    expect(v.unexpected.join(" ")).toContain("buyback");
  });

  it("catches a buyback bound that would otherwise pass vacuously", () => {
    const f = byId("A1_wash_volume");
    const rigged: AttackFixture = {
      ...f,
      // Swaps only, no time advance: the buyback loop never fires, so a
      // per-tick bound would "hold" without a single tick behind it.
      actions: f.actions.filter((a) => a.op !== "tick"),
      expect: { invariantsOk: true, maxSpendFractionOfVaultPerTick: 0.1, minBuybackTicks: 1 },
    };
    const v = runFixture(rigged);
    expect(v.status).toBe("broken");
    expect(v.unexpected.join(" ")).toContain("vacuously");
  });

  it("downgrades an incentive miss to cheap instead of broken", () => {
    const f = byId("A1_wash_volume");
    const rigged: AttackFixture = {
      ...f,
      severity: "incentive",
      expect: { ...f.expect, regimeAfter: "expansion" },
    };
    const v = runFixture(rigged);
    expect(v.status).toBe("cheap");
    expect(shouldFail([v])).toBe(false);
  });

  it("still fails CI when an incentive fixture breaks a real invariant", () => {
    const v = { ...runFixture(byId("A1_wash_volume")), severity: "incentive" as const, broken: ["S_circ drifted"] };
    expect(shouldFail([v])).toBe(true);
  });

  it("surfaces an engine throw as broken rather than swallowing it", () => {
    const f = byId("A1_wash_volume");
    const rigged: AttackFixture = {
      ...f,
      // branchId far outside the rack; the engine must not be flattered by it
      actions: [...f.actions, { t: 0, op: "retire", charterId: "c-0001", branchId: 99 }],
      expect: { ...f.expect, lastActionSucceeds: true },
    };
    const v = runFixture(rigged);
    expect(v.status).toBe("broken");
  });
});

describe("ledgerUnchangedByLastAction", () => {
  it("passes when the final action really leaves the ledger alone", () => {
    // A7's own claim: a licence payment burns, it does not debit anyone.
    const v = runFixture(byId("A7_license_inventory"));
    expect(v.status, JSON.stringify([...v.broken, ...v.unexpected])).toBe("held");
  });

  it("fails when the final action moves the ledger", () => {
    const f = byId("A7_license_inventory");
    const rigged: AttackFixture = {
      ...f,
      // A tick accrues issuance onto every live branch, so the ledger cannot
      // be unchanged across it. If this still passed, the check would be
      // measuring nothing.
      actions: [...f.actions, { t: 43_200, op: "tick", dt: 3600 }],
      expect: { invariantsOk: true, ledgerUnchangedByLastAction: "c-0001" },
    };
    const v = runFixture(rigged);
    expect(v.status).toBe("broken");
    expect(v.unexpected.join(" ")).toContain("ledgerUnchangedByLastAction");
  });
});

describe("pending fixtures", () => {
  it("lists an unimplemented fixture without running or grading it", () => {
    // Spec §6: every fixture is listed on /sentinel even before it is built.
    const f = byId("A1_wash_volume");
    const v = runFixture({ ...f, implemented: false });
    expect(v.status).toBe("pending");
    expect(v.tape).toEqual([]);
    expect(v.broken).toEqual([]);
    expect(v.unexpected).toEqual([]);
    expect(v.worldHashAfter).toBe("");
    // Pending is not a pass and not a failure: it must not gate CI either way.
    expect(shouldFail([v])).toBe(false);
  });
});

describe("report", () => {
  it("renders one row per attack with its verdict", () => {
    const verdicts = loadFixtures().map(runFixture);
    const md = reportMarkdown(verdicts, new Date("2026-01-01T00:00:00Z"));
    for (const v of verdicts) expect(md).toContain(v.id);
    expect(md).toContain("| Attack | WP | Verdict | What happened |");
    expect(md).toContain("simulation only");
  });
});
