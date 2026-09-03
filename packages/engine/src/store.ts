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
import { advancePolicy, closeEpochIfDue as closeEpochIfDueImpl } from "./epoch.js";
import { checkIn as dormancyCheckIn, reportDormant as dormancyReportDormant } from "./dormancy.js";
import {
  quoteRetirement as quoteRetirementImpl,
  retireBranch as retireBranchImpl,
} from "./exits.js";
import { invariantCheck as invariantCheckImpl } from "./invariants.js";
import { hashWorld as hashWorldImpl } from "./hash.js";
import type { Auction, LicenseQuote, Params, Quote, Scenario, World } from "./types.js";

const MAX_TICK_STEPS = 5_000;

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
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function tick(world0: World, dtSec: number): World {
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
    advancePolicy(world);
    steps += 1;
  }
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
  return dormancyCheckIn(world, charterId);
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
  closeEpochIfDueImpl(world);
  world.invariantsOk = invariantCheckImpl(world).ok;
  return world;
}

export function quoteRetirement(world: World, charterId: string, branchId: number): Quote | null {
  return quoteRetirementImpl(world, charterId, branchId);
}

export function quoteLicense(world: World): LicenseQuote {
  const a = world.licenseAuction;
  return {
    pNow: quoteLicensePrice(world),
    pFloor: a.pFloor,
    remaining: Math.max(a.cap - a.sold, 0),
    yourRemainingToday: world.params.maxLicensesPerCharterPerDay,
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
  private listeners = new Set<Listener>();

  constructor(world: World) {
    this.world = world;
  }

  apply(fn: (world: World) => World): void {
    this.world = fn(this.world);
    for (const l of this.listeners) l();
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  loadScenario(scenario: Scenario, baseParams: Params): void {
    let world = createWorld(baseParams, 0);
    for (const action of scenario.actions) {
      if (action.t > world.now) world = tick(world, action.t - world.now);
      switch (action.op) {
        case "seedGenesis":
          world = seedGenesis(world, Number(action.count ?? 0));
          break;
        case "tick":
          world = tick(world, Number(action.dt ?? 0));
          break;
        case "swap":
          world = applySwap(
            world,
            action.side as "buyStd" | "sellStd",
            BigInt(action.amount as string),
          );
          break;
        case "buyLicense":
          world = buyLicense(world, String(action.charterId));
          break;
        case "buyCharter":
          world = buyCharter(world, String(action.ownerKey), BigInt(action.payEth as string));
          break;
        case "retire":
          world = retireBranch(world, String(action.charterId), Number(action.branchId));
          break;
        case "checkIn":
          world = checkIn(world, String(action.charterId));
          break;
        case "reportDormant":
          world = reportDormant(world, String(action.charterId), String(action.reporterKey));
          break;
      }
    }
    this.world = world;
    for (const l of this.listeners) l();
  }

  export(): string {
    return hashWorldImpl(this.world) + ":" + JSON.stringify(this.world, replacer);
  }
}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
