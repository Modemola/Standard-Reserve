// Public engine API. Every exported function clones World in and returns a
// new World out — callers (including the Lab's what-if drawer) can always
// clone(), mutate hypothetically, and discard without touching live state.
import { DAY_SECONDS, GENESIS_POL } from "./constants.js";
import { initPool, buyStd, sellStd } from "./pool.js";
import {
  buyCharter as auctionBuyCharter,
  buyLicense as auctionBuyLicense,
  createCharter,
  initCharterAuction,
  initLicenseAuction,
  nextGenesisCharterId,
  quoteCharterPrice,
  quoteLicensePrice,
} from "./auctions.js";
import { streamIssuance } from "./issuance.js";
import { advancePolicy } from "./epoch.js";
import { checkIn as dormancyCheckIn, reportDormant as dormancyReportDormant } from "./dormancy.js";
import {
  quoteRetirement as quoteRetirementImpl,
  retireBranch as retireBranchImpl,
} from "./exits.js";
import { invariantCheck as invariantCheckImpl } from "./invariants.js";
import { hashWorld as hashWorldImpl } from "./hash.js";
import { appendTape, tapeRowFrom } from "./tape.js";
import type { TapeRow } from "./tape.js";
import type { EngineTrace } from "./trace.js";
import type { Auction, LicenseQuote, Params, Quote, Scenario, World } from "./types.js";

const MAX_TICK_STEPS = 5_000;

/** Every op SimStore.loadScenario knows how to replay. Exported so the
 *  bundled-scenario tests can reject a typo'd op before it ships. */
export const SCENARIO_OPS = [
  "seedGenesis",
  "tick",
  "swap",
  "buyLicense",
  "buyCharter",
  "retire",
  "checkIn",
  "reportDormant",
] as const;

function clone(world: World): World {
  return structuredClone(world);
}

export function createWorld(params: Params, now: number): World {
  const day = Math.floor(now / DAY_SECONDS);
  const world: World = {
    now,
    epoch: 0,
    epochStartedAt: now,
    day,
    params,
    pool: initPool(GENESIS_POL, params.genesisEth),
    ethInEpoch: 0n,
    ethOutEpoch: 0n,
    F: [],
    m: params.mLaunch,
    issuanceCreditsCum: 0n,
    M: 0n,
    B: 0n,
    vaults: { expansionEth: 0n, expansionGold: 0n, contractionEth: 0n },
    polEth: 0n,
    polStd: 0n,
    teamEth: 0n,
    feeBucketEth: 0n,
    lastBuybackAt: now,
    licenseAuction: undefined as unknown as Auction,
    charterAuction: undefined as unknown as Auction,
    charters: {},
    charterSeq: 0,
    withdrawWindow: [],
    invariantsOk: true,
  };
  world.licenseAuction = initLicenseAuction(world);
  world.charterAuction = initCharterAuction(world);
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

/** Lab/demo-seed helper: mint up to `count` free genesis charters (capped by genesisCharterCap). */
export function seedGenesis(world0: World, count: number, ownerKeyPrefix = "owner"): World {
  const world = clone(world0);
  const existingGenesis = Object.values(world.charters).filter((c) => c.genesis).length;
  const room = Math.max(world.params.genesisCharterCap - existingGenesis, 0);
  const n = Math.min(Math.max(count, 0), room);
  for (let i = 0; i < n; i++) {
    const id = nextGenesisCharterId(world);
    world.charters[id] = createCharter(world, id, `${ownerKeyPrefix}-${id}`, true);
  }
  world.lastError = undefined;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function tick(world0: World, dtSec: number, trace?: EngineTrace): World {
  const world = clone(world0);
  let remaining = Math.max(0, Math.floor(dtSec));
  let steps = 0;
  while (remaining > 0 && steps < MAX_TICK_STEPS) {
    const nextBoundary = world.epochStartedAt + world.params.epochSeconds;
    let segment = Math.min(remaining, nextBoundary - world.now);
    if (segment <= 0) segment = remaining;
    world.now += segment;
    streamIssuance(world, segment);
    remaining -= segment;
    advancePolicy(world, trace);
    steps += 1;
  }
  world.lastError = undefined;
  // The step bound stops a hostile or fat-fingered dt from hanging the tab,
  // but quietly advancing less time than asked for is the worse failure:
  // every downstream number would then describe a world that never reached
  // the requested instant, with nothing to say so.
  if (remaining > 0) world.lastError = "tick_truncated";
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function applySwap(world0: World, side: "buyStd" | "sellStd", ethOrStd: bigint): World {
  const world = clone(world0);
  if (ethOrStd <= 0n) {
    world.lastError = "amount must be positive";
    return world;
  }
  if (side === "buyStd") {
    const { pool, fee } = buyStd(world.pool, ethOrStd, world.params.poolFeeBps);
    world.pool = pool;
    world.ethInEpoch += ethOrStd;
    world.feeBucketEth += fee;
  } else {
    const { pool, amountOut, fee } = sellStd(world.pool, ethOrStd, world.params.poolFeeBps);
    world.pool = pool;
    world.ethOutEpoch += amountOut;
    world.feeBucketEth += fee;
  }
  world.lastError = undefined;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function buyLicense(world0: World, charterId: string): World {
  const world = clone(world0);
  const result = auctionBuyLicense(world, charterId);
  world.lastError = result.ok ? undefined : result.reason;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function buyCharter(world0: World, ownerKey: string, payEth: bigint): World {
  const world = clone(world0);
  const price = quoteCharterPrice(world);
  if (payEth < price) {
    world.lastError = "insufficient_payment";
    world.invariantsOk = invariantCheckImpl(world).ok;
    return world;
  }
  const result = auctionBuyCharter(world, ownerKey);
  world.lastError = result.ok ? undefined : result.reason;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function retireBranch(world0: World, charterId: string, branchId: number): World {
  const world = clone(world0);
  const result = retireBranchImpl(world, charterId, branchId);
  world.lastError = result.ok ? undefined : result.reason;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function checkIn(world0: World, charterId: string): World {
  const world = clone(world0);
  dormancyCheckIn(world, charterId);
  world.lastError = undefined;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function reportDormant(world0: World, charterId: string, reporterKey: string): World {
  const world = clone(world0);
  const result = dormancyReportDormant(world, charterId, reporterKey);
  world.lastError = result.ok ? undefined : result.reason;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function closeEpochIfDue(world0: World): World {
  const world = clone(world0);
  advancePolicy(world);
  world.lastError = undefined;
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function quoteRetirement(world: World, charterId: string, branchId: number): Quote | null {
  return quoteRetirementImpl(world, charterId, branchId);
}

/**
 * Licences a charter may still buy today, accounting for the day rolling
 * over since it last bought one. Exported because the cockpit needs exactly
 * this number and had been deriving it inline.
 */
export function licensesRemainingToday(world: World, charterId: string): number {
  const cap = world.params.maxLicensesPerCharterPerDay;
  const charter = world.charters[charterId];
  if (!charter || !charter.alive) return 0;
  // A counter from an earlier day does not apply to today.
  if (charter.licensesBoughtDay !== world.day) return cap;
  return Math.max(cap - charter.licensesBoughtToday, 0);
}

/**
 * `yourRemainingToday` needs to know whose licences are being counted, so pass
 * the charter. Without one it reports the per-charter cap -- the most anybody
 * could buy today -- which is the only honest answer when no charter is named.
 *
 * It used to return that cap unconditionally *with* a charter in hand too, so
 * the field read "3 left" no matter how many had already been bought. Nothing
 * caught it because the one caller that needed the number quietly computed its
 * own, correctly, and never read this one.
 */
export function quoteLicense(world: World, charterId?: string): LicenseQuote {
  const a = world.licenseAuction;
  return {
    pNow: quoteLicensePrice(world),
    pFloor: a.pFloor,
    remaining: Math.max(a.cap - a.sold, 0),
    yourRemainingToday:
      charterId === undefined
        ? world.params.maxLicensesPerCharterPerDay
        : licensesRemainingToday(world, charterId),
  };
}

export function invariantCheck(world: World) {
  return invariantCheckImpl(world);
}

export function hashWorld(world: World): string {
  return hashWorldImpl(world);
}

// --- Store wrapper for the web app ---------------------------------------

type Listener = () => void;

export class SimStore {
  world: World;
  /** Bounded log of every mutation that went through this store (cap TAPE_CAP). */
  tape: TapeRow[] = [];
  private listeners = new Set<Listener>();

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Run a mutation against the live World and record it on the tape.
   * `op` is a display label only — the tape's numbers come from diffing the
   * before/after World, so an unlabelled call still records correct figures.
   */
  apply(fn: (world: World) => World, op = "apply"): void {
    const before = this.world;
    this.world = fn(before);
    this.tape = appendTape(this.tape, tapeRowFrom(before, this.world, op));
    for (const l of this.listeners) l();
  }

  /**
   * Replace the live World wholesale — used by "Replay in Lab", which loads
   * the after-world of a Sentinel run. Kept type-agnostic so the engine never
   * has to know about Sentinel's Verdict shape.
   */
  applyWorld(world: World, op = "replay"): void {
    this.apply(() => world, op);
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  loadScenario(scenario: Scenario, baseParams: Params): void {
    let world = createWorld(baseParams, 0);
    let tape: TapeRow[] = [];
    const step = (next: World, op: string) => {
      tape = appendTape(tape, tapeRowFrom(world, next, op));
      world = next;
    };
    const unknownOps: string[] = [];
    for (const action of scenario.actions) {
      if (action.t > world.now) step(tick(world, action.t - world.now), "tick");
      switch (action.op) {
        case "seedGenesis":
          step(seedGenesis(world, Number(action.count ?? 0)), "seedGenesis");
          break;
        case "tick":
          step(tick(world, Number(action.dt ?? 0)), "tick");
          break;
        case "swap":
          step(
            applySwap(world, action.side as "buyStd" | "sellStd", BigInt(action.amount as string)),
            String(action.side),
          );
          break;
        case "buyLicense":
          step(buyLicense(world, String(action.charterId)), "buyLicense");
          break;
        case "buyCharter":
          step(
            buyCharter(world, String(action.ownerKey), BigInt(action.payEth as string)),
            "buyCharter",
          );
          break;
        case "retire":
          step(retireBranch(world, String(action.charterId), Number(action.branchId)), "retire");
          break;
        case "checkIn":
          step(checkIn(world, String(action.charterId)), "checkIn");
          break;
        case "reportDormant":
          step(
            reportDormant(world, String(action.charterId), String(action.reporterKey)),
            "reportDormant",
          );
          break;
        default:
          // A typo'd op ("buylicense") would otherwise be skipped in
          // silence: invariants still hold and the replay still hashes
          // deterministically, so nothing downstream notices that the
          // scenario quietly taught nothing.
          unknownOps.push(String((action as { op?: unknown }).op));
      }
    }
    // A scenario is a scripted replay, not something the user just did, and
    // some scenarios deliberately script a rejection to make their point --
    // ghost_purge checks a charter in so its later dormancy report *must*
    // fail. Carrying that last rejection out of the replay surfaces a red
    // toast that reads as "loading the scenario failed", which it did not.
    world.lastError = undefined;
    // A malformed scenario file, on the other hand, is a real problem and
    // does belong in front of the user.
    if (unknownOps.length > 0) world.lastError = "scenario_unknown_op";
    this.world = world;
    this.tape = tape;
    for (const l of this.listeners) l();
  }

  export(): string {
    return hashWorldImpl(this.world) + ":" + JSON.stringify(this.world, replacer);
  }
}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
