import { z } from "zod";

/** Decimal-string wei/token amount, validated and later widened to bigint. */
const bigintString = z.string().regex(/^[0-9]+$/, "expected a decimal integer string");

export const RawParamsSchema = z.object({
  meta: z.object({
    whitepaper: z.string(),
    sourceNotes: z.record(z.string()),
  }),
  epochSeconds: z.number().int().positive(),
  baseDailyStd: bigintString,
  mMin: z.number().positive(),
  mMax: z.number().positive(),
  mLaunch: z.number().positive(),
  cutStep: z.number().nonnegative(),
  raiseStep: z.number().nonnegative(),
  poolFeeBps: z.number().int().nonnegative().max(10_000),
  genesisEth: bigintString,
  ethPerGoldGram: bigintString,
  licensesPerDay: z.number().int().nonnegative(),
  maxLicensesPerCharterPerDay: z.number().int().nonnegative(),
  maxBranches: z.number().int().positive(),
  genesisCharterCap: z.number().int().nonnegative(),
  charterDailyCap: z.number().int().nonnegative(),
  charterAdminFloorEth: bigintString,
  dormancySeconds: z.number().int().positive(),
  dormancyBountyBps: z.number().int().nonnegative().max(10_000),
  dormancyBountyCapStd: bigintString,
  revocationBps: z.number().int().nonnegative().max(10_000),
  feeFloor: z.number().min(0).max(1),
  feeCeil: z.number().min(0).max(1),
  exitDenomMin: bigintString,
  withdrawWindowSeconds: z.number().int().positive(),
  // Not on the public site; required by WP §7.1's "keep a min floor param" note.
  licenseMinFloorStd: bigintString,
  // Desk-only display tolerance: how close to P_floor counts as "at the floor"
  // when solving for the wait time. Relative, so it holds at any price scale.
  floorEpsilon: z.number().min(0).max(1),
})
  /**
   * Cross-field checks. Per-field types alone let genuinely broken configs
   * through, and because README tells people to edit default.json by hand,
   * a bad edit otherwise produces silent nonsense rather than an error:
   *
   *   mMin > mMax        updateM's clamps pin m at a nonsensical value and
   *                      issuance is quietly wrong for the whole run
   *   feeFloor > feeCeil feeRateFromP collapses to the *lower* bound, and
   *                      LawMath.sol underflows on feeCeil - feeFloor
   *   genesisEth = 0     the pool opens with no ETH, so the constant
   *                      product is 0 and the AMM is broken from genesis
   */
  .superRefine((p, ctx) => {
    if (p.mMin > p.mMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mMin"],
        message: `mMin (${p.mMin}) must be <= mMax (${p.mMax})`,
      });
    }
    if (p.mLaunch < p.mMin || p.mLaunch > p.mMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mLaunch"],
        message: `mLaunch (${p.mLaunch}) must sit within [mMin, mMax] = [${p.mMin}, ${p.mMax}]`,
      });
    }
    if (p.feeFloor > p.feeCeil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["feeFloor"],
        message: `feeFloor (${p.feeFloor}) must be <= feeCeil (${p.feeCeil})`,
      });
    }
    if (BigInt(p.genesisEth) <= 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["genesisEth"],
        message: "genesisEth must be > 0; the genesis pool needs ETH on one side to have a price",
      });
    }
    if (BigInt(p.exitDenomMin) <= 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exitDenomMin"],
        message: "exitDenomMin must be > 0; it is the denominator floor in the resolution fee",
      });
    }
  });

export type RawParams = z.infer<typeof RawParamsSchema>;

/** Engine-facing params: wei/token amounts widened to bigint (1e18 fixed point). */
export interface Params {
  meta: RawParams["meta"];
  epochSeconds: number;
  baseDailyStd: bigint;
  mMin: number;
  mMax: number;
  mLaunch: number;
  cutStep: number;
  raiseStep: number;
  poolFeeBps: number;
  genesisEth: bigint;
  ethPerGoldGram: bigint;
  licensesPerDay: number;
  maxLicensesPerCharterPerDay: number;
  maxBranches: number;
  genesisCharterCap: number;
  charterDailyCap: number;
  charterAdminFloorEth: bigint;
  dormancySeconds: number;
  dormancyBountyBps: number;
  dormancyBountyCapStd: bigint;
  revocationBps: number;
  feeFloor: number;
  feeCeil: number;
  exitDenomMin: bigint;
  withdrawWindowSeconds: number;
  licenseMinFloorStd: bigint;
  floorEpsilon: number;
}

const BIGINT_FIELDS = [
  "baseDailyStd",
  "genesisEth",
  "ethPerGoldGram",
  "charterAdminFloorEth",
  "dormancyBountyCapStd",
  "exitDenomMin",
  "licenseMinFloorStd",
] as const;

/** Validate raw JSON (e.g. default.json or a scenario paramsOverlay) and widen to engine Params. */
export function loadParams(raw: unknown): Params {
  const parsed = RawParamsSchema.parse(raw);
  const out: Record<string, unknown> = { ...parsed };
  for (const key of BIGINT_FIELDS) {
    out[key] = BigInt(parsed[key]);
  }
  return out as unknown as Params;
}

/** Shallow-merge a partial raw overlay onto raw defaults, then load. Used by scenarios. */
export function loadParamsWithOverlay(defaults: RawParams, overlay: Partial<RawParams>): Params {
  return loadParams({ ...defaults, ...overlay });
}
