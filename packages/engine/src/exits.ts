// WP §9 — resolution (exit) fee and branch retirement.
import type { Quote, World } from "./types.js";

function trailingWithdrawn(world: World): bigint {
  const cutoff = world.now - world.params.withdrawWindowSeconds;
  let w = 0n;
  for (const ev of world.withdrawWindow) if (ev.ts >= cutoff) w += ev.amount;
  return w;
}

function totalLedger(world: World): bigint {
  let d = 0n;
  for (const charter of Object.values(world.charters)) {
    if (!charter.alive) continue;
    for (const branch of charter.branches) if (branch.alive) d += branch.ledger;
  }
  return d;
}

/** feeRate = feeFloor + (feeCeil - feeFloor) * P^2, clamped to [feeFloor, feeCeil]. */
export function feeRateFromP(feeFloor: number, feeCeil: number, P: number): number {
  const rate = feeFloor + (feeCeil - feeFloor) * P * P;
  return Math.min(feeCeil, Math.max(feeFloor, rate));
}

/** feeRate = feeFloor + (feeCeil - feeFloor) * P^2, P = W / max(D+W, exitDenomMin). */
export function computeFeeRate(world: World): number {
  const W = trailingWithdrawn(world);
  const D = totalLedger(world);
  const denom = D + W > world.params.exitDenomMin ? D + W : world.params.exitDenomMin;
  const P = denom > 0n ? Number(W) / Number(denom) : 0;
  return feeRateFromP(world.params.feeFloor, world.params.feeCeil, P);
}

export function quoteRetirement(world: World, charterId: string, branchId: number): Quote | null {
  const charter = world.charters[charterId];
  const branch = charter?.branches[branchId];
  if (!charter || !branch || !branch.alive) return null;
  const feeRate = computeFeeRate(world);
  const fee = bigintMul(branch.ledger, feeRate);
  return {
    charterId,
    branchId,
    ledger: branch.ledger,
    feeRate,
    fee,
    mintToUser: branch.ledger - fee,
    lockedAt: world.now,
  };
}

function bigintMul(v: bigint, rate: number): bigint {
  const rateFixed = BigInt(Math.round(rate * 1_000_000));
  return (v * rateFixed) / 1_000_000n;
}

export interface RetireResult {
  world: World;
  ok: boolean;
  reason?: string;
  quote?: Quote;
  charterBurned?: boolean;
}

export function retireBranch(world: World, charterId: string, branchId: number): RetireResult {
  const charter = world.charters[charterId];
  const branch = charter?.branches[branchId];
  if (!charter || !charter.alive || !branch || !branch.alive) {
    return { world, ok: false, reason: "unknown_branch" };
  }

  const quote = quoteRetirement(world, charterId, branchId);
  if (!quote) return { world, ok: false, reason: "unknown_branch" };

  const halfFee = quote.fee / 2n;
  const rebateTotal = quote.fee - halfFee;

  const otherLive = charter.branches.filter((b) => b.alive && b.id !== branchId);
  if (otherLive.length > 0) {
    const rebatePerBranch = rebateTotal / BigInt(otherLive.length);
    for (const b of otherLive) b.ledger += rebatePerBranch;
    // Integer division truncates; credit the undistributed remainder to the
    // first branch rather than letting it vanish from tracked totals.
    const distributed = rebatePerBranch * BigInt(otherLive.length);
    const dust = rebateTotal - distributed;
    if (dust > 0n) otherLive[0].ledger += dust;
  } else {
    // No other branches to rebate; the remainder burns too rather than vanishing.
    world.B += rebateTotal;
  }

  world.B += halfFee;
  world.M += quote.mintToUser;
  world.withdrawWindow.push({ ts: world.now, amount: quote.mintToUser });

  branch.alive = false;
  branch.ledger = 0n;
  charter.lastInteraction = world.now;

  const stillLive = charter.branches.some((b) => b.alive);
  let charterBurned = false;
  if (!stillLive) {
    charter.alive = false;
    charterBurned = true;
  }

  return { world, ok: true, quote, charterBurned };
}
