import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import { STRATEGIES, runAttack } from "../src/adversary.js";
import type { Params } from "../src/types.js";

/**
 * These guard the *instrument*, not the protocol.
 *
 * An adversarial probe that measures the wrong thing is worse than no probe:
 * it produces a confident "no exploit found" that nobody re-checks. Two of
 * these exist because the first draft did exactly that — it forgot to credit
 * the dormancy bounty, so "reporting yourself does not pay" rested on never
 * having counted the payment.
 */

const DAYS = 60;

describe("adversarial probes", () => {
  it("is deterministic", () => {
    const a = runAttack(DEFAULT_PARAMS, "pump_and_harvest", DAYS);
    const b = runAttack(DEFAULT_PARAMS, "pump_and_harvest", DAYS);
    expect(a.ledger).toEqual(b.ledger);
    expect(a.edgeStd).toBe(b.edgeStd);
  });

  it("measures every strategy against a passive control", () => {
    // Without a control, any strategy holding a live branch ends with tokens
    // and looks like it won — issuance streams to everyone regardless.
    const r = runAttack(DEFAULT_PARAMS, "pump_and_harvest", DAYS);
    expect(r.controlNetStd).toBeGreaterThan(0n);
    expect(r.edgeStd).toBe(r.netStd - r.controlNetStd);
  });

  it("charges the adversary for licences the engine does not debit", () => {
    // v1 has no wallet, so buyLicense burns the price into B without taking it
    // from anyone. If the harness did not charge for it, licence churn would
    // report as free money — an artifact of the simplification, not a finding
    // about the protocol.
    const r = runAttack(DEFAULT_PARAMS, "licence_churn", DAYS);
    expect(r.ledger.stdPaidForLicences).toBeGreaterThan(0n);
    expect(r.netStd).toBeLessThan(r.ledger.stdMinted + r.ledger.stdInBranches);
  });

  it("credits the dormancy bounty it claims to be weighing", () => {
    // The regression this exists for: the first version zeroed the branch
    // ledger and never added the bounty, so the strategy's own question --
    // "does the bounty beat the revocation?" -- was answered without ever
    // measuring the bounty.
    const r = runAttack(DEFAULT_PARAMS, "self_report_dormancy", DAYS);
    expect(r.ledger.stdMinted).toBeGreaterThan(0n);
    // And it is capped, which is why it cannot beat losing the position.
    expect(r.ledger.stdMinted).toBeLessThanOrEqual(DEFAULT_PARAMS.dormancyBountyCapStd);
  });

  it("the pump genuinely moves the policy it is attacking", () => {
    // If m did not rise, the strategy would be testing nothing and the
    // "unprofitable" conclusion would be vacuous.
    const r = runAttack(DEFAULT_PARAMS, "pump_and_harvest", DAYS);
    expect(r.peakM).toBeGreaterThan(r.controlPeakM);
    expect(r.meanM).toBeGreaterThan(r.controlMeanM);
    expect(r.edgeStd).toBeGreaterThan(0n); // it does harvest more issuance
  });

  it("the pump still loses money at the default pool depth", () => {
    // Costs far more in slippage than the issuance is worth at pool spot.
    const r = runAttack(DEFAULT_PARAMS, "pump_and_harvest", DAYS);
    expect(r.netEth).toBeLessThan(0n);
    const spent = Number(r.ledger.ethSpent);
    const lost = Number(-r.netEth);
    expect(lost / spent).toBeGreaterThan(0.2); // a punishing round trip
  });

  it("that defence is slippage, and it weakens as the pool deepens", () => {
    // The finding worth reporting: the round-trip cost scales inversely with
    // liquidity while the issuance edge does not, so the protection against
    // manufacturing the signal erodes exactly as the protocol's own
    // liquidity goals are met.
    const at = (eth: number) => {
      const params = { ...DEFAULT_PARAMS, genesisEth: BigInt(eth) * 10n ** 18n } as Params;
      const r = runAttack(params, "pump_and_harvest", DAYS);
      return {
        lossFraction: Number(-r.netEth) / Number(r.ledger.ethSpent),
        edgeStd: r.edgeStd,
      };
    };
    const shallow = at(100);
    const deep = at(100_000);

    expect(deep.lossFraction).toBeLessThan(shallow.lossFraction / 10);
    // The reward does not shrink with depth — that asymmetry is the point.
    expect(deep.edgeStd).toBe(shallow.edgeStd);
  });

  it("rejects an unknown strategy rather than silently doing nothing", () => {
    expect(() => runAttack(DEFAULT_PARAMS, "no_such_strategy", 10)).toThrow(/unknown strategy/);
  });

  it("every strategy declares the question it is asking", () => {
    for (const [name, s] of Object.entries(STRATEGIES)) {
      expect(s.question, `${name} has no question`).toBeTruthy();
      expect(s.name).toBe(name);
    }
  });
});
