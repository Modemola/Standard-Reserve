import { describe, expect, it } from "vitest";
import { loadFixtures } from "../src/runAll.js";
import { runFixture } from "../src/runFixture.js";

const fixture = () => loadFixtures().find((f) => f.id === "A1_wash_volume")!;

describe("A1 wash volume", () => {
  it("holds: round-tripped volume nets to zero flow and still takes the cut", () => {
    const v = runFixture(fixture());
    expect(v.status, JSON.stringify([...v.broken, ...v.unexpected])).toBe("held");
  });

  it("actually moved real volume — the pass is not vacuous", () => {
    const v = runFixture(fixture());
    const inRow = v.tape.find((r) => r.op === "buyStd");
    const outRow = v.tape.find((r) => r.op === "sellStd");
    expect(BigInt(inRow?.ethIn ?? "0")).toBe(10n * 10n ** 18n);
    // The solved sell pulls the same ETH back out, to the wei.
    expect(BigInt(outRow?.ethOut ?? "0")).toBe(10n * 10n ** 18n);
  });

  it("cuts the multiplier despite the volume", () => {
    const v = runFixture(fixture());
    expect(v.before.m).toBe(1);
    expect(v.after.m).toBe(0.75);
    expect(v.after.regime).toBe("contraction");
  });
});
