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
