// WP §6-8 — charter/license Dutch auctions.
import { DAY_SECONDS } from "./constants.js";
import { computeEpochIssuance } from "./issuance.js";
import type { Auction, Charter, World } from "./types.js";

/** Convert a wei-ish bigint to a float in whole-token units without overflow. */
function toUnits(v: bigint): number {
  return Number(v / 1_000_000n) / 1e12;
}
function fromUnits(x: number): bigint {
  return BigInt(Math.max(0, Math.round(x * 1e12))) * 1_000_000n;
}

/** P(t) = P_start * (P_floor / P_start) ^ (t / 86400), t clamped to [0, 86400]. */
export function dutchPrice(pStart: bigint, pFloor: bigint, elapsedSec: number): bigint {
  if (pStart <= 0n) return pFloor;
  const t = Math.min(Math.max(elapsedSec, 0), DAY_SECONDS);
  const startUnits = toUnits(pStart);
  const floorUnits = toUnits(pFloor);
  if (startUnits <= 0) return pFloor;
  const ratio = Math.max(floorUnits / startUnits, 1e-12);
  const price = startUnits * Math.pow(ratio, t / DAY_SECONDS);
  return fromUnits(price);
}

function dayStart(day: number): number {
  return day * DAY_SECONDS;
}

export function licenseFloor(world: World): bigint {
  const N = countLiveBranches(world);
  const { params } = world;
  if (N === 0) return params.licenseMinFloorStd;
  const I_n = computeEpochIssuance(world);
  const epochDays = params.epochSeconds / DAY_SECONDS;
  const dailyYieldPerBranch = Number(toUnits(I_n)) / N / Math.max(epochDays, 1e-9);
  const floorUnits = 2 * dailyYieldPerBranch;
  const floor = fromUnits(floorUnits);
  return floor > params.licenseMinFloorStd ? floor : params.licenseMinFloorStd;
}

function countLiveBranches(world: World): number {
  let n = 0;
  for (const charter of Object.values(world.charters)) {
    if (!charter.alive) continue;
    for (const branch of charter.branches) if (branch.alive) n++;
  }
  return n;
}

export function initLicenseAuction(world: World): Auction {
  const floor = licenseFloor(world);
  return {
    kind: "license",
    day: world.day,
    pStart: floor * 2n,
    pFloor: floor,
    pLast: floor,
    sold: 0,
    cap: world.params.licensesPerDay,
    opensAt: dayStart(world.day),
    closesAt: dayStart(world.day) + DAY_SECONDS,
  };
}

export function initCharterAuction(world: World): Auction {
  const floor = world.params.charterAdminFloorEth;
  return {
    kind: "charter",
    day: world.day,
    pStart: floor * 3n,
    pFloor: floor,
    pLast: floor,
    sold: 0,
    cap: world.params.charterDailyCap,
    opensAt: dayStart(world.day),
    closesAt: dayStart(world.day) + DAY_SECONDS,
  };
}

function rollOneDay(
  auction: Auction,
  newDay: number,
  newFloor: bigint,
  newCap: number,
  openMultiplier: bigint,
): Auction {
  const hadSale = auction.sold > 0;
  const pStart = hadSale ? auction.pLast * openMultiplier : newFloor * openMultiplier;
  return {
    ...auction,
    day: newDay,
    pStart,
    pFloor: newFloor,
    sold: 0,
    cap: newCap,
    opensAt: dayStart(newDay),
    closesAt: dayStart(newDay) + DAY_SECONDS,
  };
}

/** Advance license/charter auctions to world.day, rolling one day at a time. */
export function rollAuctionsIfNeeded(world: World): World {
  while (world.licenseAuction.day < world.day) {
    const nextDay = world.licenseAuction.day + 1;
    world.licenseAuction = rollOneDay(
      world.licenseAuction,
      nextDay,
      licenseFloor(world),
      world.params.licensesPerDay,
      2n, // WP §6-8 — license open: P_start = 2 * P_last (or 2 * P_floor)
    );
  }
  while (world.charterAuction.day < world.day) {
    const nextDay = world.charterAuction.day + 1;
    world.charterAuction = rollOneDay(
      world.charterAuction,
      nextDay,
      world.params.charterAdminFloorEth,
      world.params.charterDailyCap,
      3n, // WP §6-8 — charter open: P_start = 3 * P_last (or 3 * adminFloor)
    );
  }
  return world;
}

export function quoteLicensePrice(world: World): bigint {
  const a = world.licenseAuction;
  return dutchPrice(a.pStart, a.pFloor, world.now - a.opensAt);
}

export function quoteCharterPrice(world: World): bigint {
  const a = world.charterAuction;
  return dutchPrice(a.pStart, a.pFloor, world.now - a.opensAt);
}

function emptyBranches(maxBranches: number): Charter["branches"] {
  return Array.from({ length: maxBranches }, (_, id) => ({
    id,
    openedAt: 0,
    ledger: 0n,
    alive: false,
  }));
}

export function nextGenesisCharterId(world: World): string {
  world.charterSeq += 1;
  return `c-${String(world.charterSeq).padStart(4, "0")}`;
}

export function createCharter(
  world: World,
  id: string,
  ownerKey: string,
  genesis: boolean,
): Charter {
  const branches = emptyBranches(world.params.maxBranches);
  branches[0] = { id: 0, openedAt: world.now, ledger: 0n, alive: true };
  return {
    id,
    ownerKey,
    soulbound: true,
    branches,
    lastInteraction: world.now,
    licensesBoughtToday: 0,
    licensesBoughtDay: world.day,
    genesis,
    alive: true,
  };
}

export interface BuyLicenseResult {
  world: World;
  ok: boolean;
  reason?: string;
  price?: bigint;
}

/** Buy a branch license for `charterId`, burning 100% of the (sim) $STANDARD payment. */
export function buyLicense(world: World, charterId: string): BuyLicenseResult {
  const charter = world.charters[charterId];
  if (!charter || !charter.alive) return { world, ok: false, reason: "unknown_charter" };

  if (charter.licensesBoughtDay !== world.day) {
    charter.licensesBoughtDay = world.day;
    charter.licensesBoughtToday = 0;
  }
  if (charter.licensesBoughtToday >= world.params.maxLicensesPerCharterPerDay) {
    return { world, ok: false, reason: "per_charter_daily_cap" };
  }
  if (world.licenseAuction.sold >= world.licenseAuction.cap) {
    return { world, ok: false, reason: "daily_cap_reached" };
  }
  const slot = charter.branches.find((b) => !b.alive);
  if (!slot) return { world, ok: false, reason: "max_branches" };

  const price = quoteLicensePrice(world);
  slot.alive = true;
  slot.openedAt = world.now;
  slot.ledger = 0n;

  charter.licensesBoughtToday += 1;
  charter.lastInteraction = world.now;

  world.licenseAuction.sold += 1;
  world.licenseAuction.pLast = price;
  world.B += price; // 100% of license payment burns (WP §3)

  return { world, ok: true, price };
}

export interface BuyCharterResult {
  world: World;
  ok: boolean;
  reason?: string;
  price?: bigint;
  charterId?: string;
}

/** Buy a fresh (post-genesis) charter, paid in ETH; ETH routes to the epoch fee bucket. */
export function buyCharter(world: World, ownerKey: string): BuyCharterResult {
  if (world.charterAuction.cap <= 0) return { world, ok: false, reason: "auctions_closed" };
  if (world.charterAuction.sold >= world.charterAuction.cap) {
    return { world, ok: false, reason: "daily_cap_reached" };
  }
  const price = quoteCharterPrice(world);
  const id = `c-${world.charterSeq + 1}-${world.now}`;
  world.charterSeq += 1;
  world.charters[id] = createCharter(world, id, ownerKey, false);

  world.charterAuction.sold += 1;
  world.charterAuction.pLast = price;
  world.feeBucketEth += price; // WP §11 — charter auction ETH counts as epoch income

  return { world, ok: true, price, charterId: id };
}
