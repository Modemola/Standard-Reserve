// Attack fixtures and verdicts. A fixture is a hostile script against the
// Twin's own engine; a verdict is what the engine did about it.
import { z } from "zod";
import type { Regime, TapeRow } from "@standard-law/engine";

const bigintString = z.string().regex(/^-?[0-9]+$/, "expected a decimal integer string");

/** Ops a fixture may drive. Everything maps onto a real exported engine action. */
export const AttackOpSchema = z.enum([
  "seedGenesis",
  "tick",
  "swap",
  "buyLicense",
  "buyCharter",
  "retire",
  "checkIn",
  "reportDormant",
  "setNow",
  "setCharterCap",
  "fastForwardEpochs",
]);
export type AttackOp = z.infer<typeof AttackOpSchema>;

export const AttackActionSchema = z.object({
  /** Seconds from fixture start. The runner ticks forward to reach it. */
  t: z.number().nonnegative(),
  op: AttackOpSchema,
  side: z.enum(["buyStd", "sellStd"]).optional(),
  amount: bigintString.optional(),
  /**
   * Sell exactly enough $STANDARD to pull this much ETH out of the pool.
   * The runner binary-searches the engine's own sellStd — it never
   * re-derives pool math. Used by the wash fixtures to land F_n on zero.
   */
  targetEthOut: bigintString.optional(),
  count: z.number().int().nonnegative().optional(),
  charterId: z.string().optional(),
  branchId: z.number().int().nonnegative().optional(),
  dt: z.number().nonnegative().optional(),
  ownerKey: z.string().optional(),
  reporterKey: z.string().optional(),
  cap: z.number().int().nonnegative().optional(),
  epochs: z.number().int().nonnegative().optional(),
  note: z.string().optional(),
});
export type AttackAction = z.infer<typeof AttackActionSchema>;

export const AttackExpectSchema = z.object({
  invariantsOk: z.boolean().optional(),
  regimeAfter: z.enum(["expansion", "contraction"]).optional(),
  mMustNotIncrease: z.boolean().optional(),
  /**
   * Dust cap on |F_n| for every epoch this attack touched — each epoch closed
   * during the run plus the one still in progress. Stated as a cap rather than
   * an equality because a round-trip can leave a few wei behind.
   */
  fnAbsMax: bigintString.optional(),
  polMustNotDecrease: z.boolean().optional(),
  /**
   * Gold is a constant zero in v1 -- nothing writes it -- so "must not
   * decrease" was a check that could not fail. Equality is the claim A14
   * actually makes, and it goes red the day somebody wires the conversion,
   * which is the day both fixtures' notes stop being true.
   */
  vaultGoldUnchanged: z.boolean().optional(),
  sMaxMustNotIncrease: z.boolean().optional(),
  /** Proves something actually burned: S_max = HARD_CAP - B only falls on a burn. */
  sMaxMustDecrease: z.boolean().optional(),
  polMustIncrease: z.boolean().optional(),
  /** Per hourly buyback, from the engine trace: spend <= fraction * poolEth. */
  maxSpendFractionOfPoolPerTick: z.number().optional(),
  /** Per hourly buyback, from the engine trace: spend <= fraction * vaultEth. */
  maxSpendFractionOfVaultPerTick: z.number().optional(),
  /**
   * Guards the two bounds above against passing vacuously: an attack that
   * never triggers a buyback would otherwise "respect" every per-tick cap.
   */
  minBuybackTicks: z.number().int().nonnegative().optional(),
  /** Pins the multiplier after the run — sharper than mMustNotIncrease alone. */
  mAtMost: z.number().optional(),
  /** The last action must have been rejected with this reason. */
  lastErrorContains: z.string().optional(),
  /** Reasons the engine must have rejected at some point during the run. */
  rejectionsInclude: z.array(z.string()).optional(),
  /** The last action must have succeeded. */
  lastActionSucceeds: z.boolean().optional(),
  feeRateMustRise: z.boolean().optional(),
  feeRateAtMost: z.number().optional(),
  charterGone: z.string().optional(),
  charterAlive: z.string().optional(),
  /**
   * This charter's ledger must be identical either side of the *final*
   * action. Scoped to the last action rather than the whole run because any
   * tick accrues issuance, which made a whole-run comparison unusable for the
   * two claims that need it: that buying a licence debits no ledger, and that
   * a refused dormancy report leaves its target untouched.
   */
  ledgerUnchangedByLastAction: z.string().optional(),
  maxLiveBranchesFor: z.string().optional(),
  issuanceCreditsAtMost: bigintString.optional(),
  baseIssuanceStopped: z.boolean().optional(),
  notesYellow: z.string().optional(),
  /** When the yellow note applies. Defaults to "always". */
  yellowWhen: z.enum(["always", "mIncreased", "regimeFlipped"]).optional(),
});
export type AttackExpect = z.infer<typeof AttackExpectSchema>;

export const AttackFixtureSchema = z.object({
  id: z.string(),
  wp: z.string(),
  title: z.string(),
  teach: z.string(),
  /** invariant: a miss fails CI. incentive: a miss is yellow, never red. */
  severity: z.enum(["invariant", "incentive"]),
  paramsOverlay: z.record(z.unknown()).default({}),
  seed: z.enum(["default", "empty", "c-0042"]).default("default"),
  /** Set false to list the fixture on /sentinel as pending without running it. */
  implemented: z.boolean().default(true),
  actions: z.array(AttackActionSchema),
  expect: AttackExpectSchema,
});
export type AttackFixture = z.infer<typeof AttackFixtureSchema>;

export type VerdictStatus = "held" | "cheap" | "broken" | "pending";

export interface Snapshot {
  epoch: number;
  regime: Regime;
  m: number;
  Fn: string;
  signal: string;
  S_circ: string;
  S_max: string;
  polEth: string;
  polStd: string;
  expansionEth: string;
  expansionGold: string;
  contractionEth: string;
  /** Live branches system-wide. */
  N: number;
}

export interface Verdict {
  id: string;
  wp: string;
  title: string;
  teach: string;
  severity: AttackFixture["severity"];
  status: VerdictStatus;
  /** Invariant names the engine itself reported broken. */
  broken: string[];
  /** Expectation fields that did not match. */
  unexpected: string[];
  before: Snapshot;
  after: Snapshot;
  tape: TapeRow[];
  notes: string;
  worldHashAfter: string;
}

export function parseFixture(raw: unknown): AttackFixture {
  return AttackFixtureSchema.parse(raw);
}
