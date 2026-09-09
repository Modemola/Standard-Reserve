import { describe, expect, it } from "vitest";
import { DEFAULT_RAW_PARAMS, loadParams } from "@standard-law/params";

/**
 * README tells people to edit packages/params/default.json by hand, so a bad
 * edit has to fail loudly at load rather than produce silent nonsense
 * downstream.
 */
describe("params cross-field validation", () => {
  const load = (patch: Record<string, unknown>) =>
    loadParams({ ...DEFAULT_RAW_PARAMS, ...patch });

  it("accepts the shipped defaults", () => {
    expect(() => load({})).not.toThrow();
  });

  it("rejects mMin above mMax", () => {
    // updateM clamps with max(mMin, ..) and min(mMax, ..); inverted, m pins
    // to a nonsensical value and issuance is quietly wrong for the whole run.
    expect(() => load({ mMin: 2.0, mMax: 0.5 })).toThrow(/mMin/);
  });

  it("rejects an mLaunch outside [mMin, mMax]", () => {
    expect(() => load({ mLaunch: 99 })).toThrow(/mLaunch/);
  });

  it("rejects feeFloor above feeCeil", () => {
    // feeRateFromP would collapse to the lower bound, and LawMath.sol
    // underflows computing feeCeil - feeFloor on uint256.
    expect(() => load({ feeFloor: 0.9, feeCeil: 0.1 })).toThrow(/feeFloor/);
  });

  it("rejects a genesis pool with no ETH", () => {
    // k = eth * std = 0 — the AMM has no price and invariants fail at once.
    expect(() => load({ genesisEth: "0" })).toThrow(/genesisEth/);
  });

  it("rejects a zero exitDenomMin", () => {
    expect(() => load({ exitDenomMin: "0" })).toThrow(/exitDenomMin/);
  });

  it("still allows deliberately inert issuance (a valid experiment)", () => {
    // Zeroing baseDaily to isolate fee dynamics is a legitimate thing to
    // simulate, not a broken config — validation must not over-reach.
    expect(() => load({ baseDailyStd: "0" })).not.toThrow();
  });
});
