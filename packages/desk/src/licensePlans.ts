// WP §7 — the licence board as a decaying reserve, not an order book.
// Three priced plans: take it now, wait a couple of hours, or sit until the
// price is effectively at the floor. Each plan is simulated on a clone.
import { DAY_SECONDS, buyLicense, dutchPrice, supplyMax, tick } from "@standard-law/engine";
import type { World } from "@standard-law/engine";

export interface LicensePlanPreview {
  /** Live branches system-wide after the hypothetical purchase. */
  N: number;
  yourBranches: number;
  /** yourBranches / N — the slice of issuance this charter would draw. */
  share: number;
  /** $STANDARD burned by the purchase. */
  Bdelta: bigint;
  S_max: bigint;
}

export interface LicensePlanRow {
  kind: "now" | "wait" | "floor";
  waitSeconds: number;
  P: bigint;
  available: boolean;
  reason?: string;
  preview: LicensePlanPreview;
}

export const DEFAULT_WAIT_SECONDS = 7_200;

function liveBranches(world: World): number {
  let n = 0;
  for (const c of Object.values(world.charters)) {
    if (!c.alive) continue;
    for (const b of c.branches) if (b.alive) n++;
  }
  return n;
}

function branchesOf(world: World, charterId: string): number {
  const c = world.charters[charterId];
  if (!c || !c.alive) return 0;
  return c.branches.filter((b) => b.alive).length;
}

/**
 * Seconds until P(t) is within params.floorEpsilon of the floor, clamped to
 * the auction's close. Solved from the decay curve rather than stepped.
 */
export function secondsUntilFloor(world: World): number {
  const a = world.licenseAuction;
  const untilClose = Math.max(a.closesAt - world.now, 0);
  if (a.pStart <= a.pFloor || a.pFloor <= 0n) return 0;

  // P(t) = pStart * r^(t/86400) with r = pFloor/pStart, so the epsilon band is
  // reached at t = 86400 * (1 + ln(1+eps) / ln r).
  const r = Number(a.pFloor) / Number(a.pStart);
  const eps = world.params.floorEpsilon;
  if (!(r > 0) || !(r < 1)) return untilClose;
  const fromOpen = DAY_SECONDS * (1 + Math.log(1 + eps) / Math.log(r));
  const absolute = a.opensAt + Math.ceil(fromOpen);
  return Math.max(0, Math.min(absolute - world.now, untilClose));
}

function planAt(world: World, charterId: string, kind: LicensePlanRow["kind"], waitSeconds: number): LicensePlanRow {
  const wait = Math.max(0, Math.round(waitSeconds));
  const future = wait > 0 ? tick(world, wait) : world;
  const a = future.licenseAuction;
  const P = dutchPrice(a.pStart, a.pFloor, future.now - a.opensAt);

  // Legality comes from the engine itself, so this can never drift from the
  // rule the Cockpit enforces.
  const bought = buyLicense(future, charterId);
  const available = bought.lastError === undefined;

  const source = available ? bought : future;
  const N = liveBranches(source);
  const yourBranches = branchesOf(source, charterId);

  return {
    kind,
    waitSeconds: wait,
    P,
    available,
    reason: bought.lastError,
    preview: {
      N,
      yourBranches,
      share: N > 0 ? yourBranches / N : 0,
      Bdelta: available ? bought.B - future.B : 0n,
      S_max: supplyMax(source),
    },
  };
}

/**
 * Always three rows, in this order: now, wait, floor. A row that is not
 * legal reports why instead of interpolating a fill that could not happen.
 */
export function licensePlans(
  world: World,
  charterId: string,
  waitSecondsOptions: number = DEFAULT_WAIT_SECONDS,
): LicensePlanRow[] {
  return [
    planAt(world, charterId, "now", 0),
    planAt(world, charterId, "wait", waitSecondsOptions),
    planAt(world, charterId, "floor", secondsUntilFloor(world)),
  ];
}
