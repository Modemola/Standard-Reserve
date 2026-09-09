import type { Params } from "@standard-law/params";

export type { Params };

export type Regime = "expansion" | "contraction";

export interface Branch {
  id: number; // 0..maxBranches-1
  openedAt: number; // unix seconds
  ledger: bigint; // accrued, unminted $STANDARD
  alive: boolean;
}

export interface Charter {
  id: string;
  ownerKey: string;
  soulbound: true;
  branches: Branch[]; // length params.maxBranches, dead slots have alive:false
  lastInteraction: number;
  licensesBoughtToday: number;
  licensesBoughtDay: number; // day index the counter above applies to
  genesis: boolean;
  alive: boolean; // false once the charter itself has been burned
}

export interface Auction {
  kind: "license" | "charter";
  day: number; // floor(unix seconds / 86400)
  pStart: bigint;
  pFloor: bigint;
  pLast: bigint;
  sold: number;
  cap: number;
  opensAt: number;
  closesAt: number;
}

export interface Pool {
  eth: bigint;
  std: bigint;
}

export interface Vaults {
  expansionEth: bigint;
  expansionGold: bigint; // 1e18 = 1 gram, placeholder oracle unit
  contractionEth: bigint;
}

export interface WithdrawEvent {
  ts: number;
  amount: bigint; // $STANDARD minted to a user on retirement
}

export interface World {
  now: number;
  epoch: number;
  epochStartedAt: number;
  day: number; // floor(now / 86400), drives daily auction rollover
  params: Params;
  pool: Pool;
  ethInEpoch: bigint;
  ethOutEpoch: bigint;
  F: bigint[]; // history, index = epoch
  m: number; // current issuance multiplier, active for the *current* epoch
  issuanceCreditsCum: bigint; // cumulative $STANDARD credited via base issuance
  M: bigint; // cumulative withdrawal mints
  B: bigint; // cumulative burns
  vaults: Vaults;
  polEth: bigint;
  polStd: bigint;
  teamEth: bigint;
  feeBucketEth: bigint; // current epoch, unallocated trading/auction ETH income
  lastBuybackAt: number; // unix seconds, last contraction buyback tick
  licenseAuction: Auction;
  charterAuction: Auction;
  charters: Record<string, Charter>;
  charterSeq: number; // next genesis charter ordinal, for id generation
  withdrawWindow: WithdrawEvent[]; // trailing tape, pruned to withdrawWindowSeconds
  invariantsOk: boolean;
  lastError?: string;
}

/**
 * A retirement quote. Every field here is what the cockpit renders in the
 * exit ticket, and retireBranch computes the real move from this same
 * function, so the two cannot disagree (locked down by a property test).
 *
 * There is deliberately no `lockedAt`. The field used to exist and nothing
 * ever read it -- the name promised a time-locked quote the engine does not
 * implement, since retireBranch recomputes rather than honouring a quote
 * issued earlier. A type that describes behaviour the code does not have is
 * worse than no field at all. If quotes ever need to survive a round trip
 * (a network boundary, a signed intent), add the staleness window and the
 * honouring logic together -- not the timestamp on its own.
 */
export interface Quote {
  charterId: string;
  branchId: number;
  ledger: bigint;
  feeRate: number;
  fee: bigint;
  mintToUser: bigint;
}

export interface LicenseQuote {
  pNow: bigint;
  pFloor: bigint;
  remaining: number;
  yourRemainingToday: number;
}

export interface InvariantResult {
  ok: boolean;
  failures: string[];
}

export interface ScenarioAction {
  t: number;
  op:
    | "seedGenesis"
    | "tick"
    | "swap"
    | "buyLicense"
    | "buyCharter"
    | "retire"
    | "checkIn"
    | "reportDormant";
  [key: string]: unknown;
}

export interface Scenario {
  id: string;
  title: string;
  teach: string;
  paramsOverlay?: Record<string, unknown>;
  actions: ScenarioAction[];
}
