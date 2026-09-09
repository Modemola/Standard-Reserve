// WP §9 — what leaving costs now, and what it would cost if the door got
// busier. The crowd slider works on a clone; the live World is never touched.
import { computeFeeRate, quoteRetirement } from "@standard-law/engine";
import type { World } from "@standard-law/engine";

export interface ExitImpact {
  /** $STANDARD withdrawn system-wide in the trailing window. */
  W: bigint;
  /** Ledger still sitting at the bank. */
  D: bigint;
  feeRateNow: number;
  /** Fee rate once `retireCount` more exits are in the same window. */
  feeRateIfRetireLvl: number;
  burn: bigint;
  rebate: bigint;
  mintToUser: bigint;
  /** True when this is the charter's last live branch, so the charter burns. */
  lastBranch: boolean;
}

function trailingWithdrawn(world: World): bigint {
  const cutoff = world.now - world.params.withdrawWindowSeconds;
  let w = 0n;
  for (const ev of world.withdrawWindow) if (ev.ts >= cutoff) w += ev.amount;
  return w;
}

function totalLedger(world: World): bigint {
  let d = 0n;
  for (const c of Object.values(world.charters)) {
    if (!c.alive) continue;
    for (const b of c.branches) if (b.alive) d += b.ledger;
  }
  return d;
}

/**
 * Fee rate if `retireCount` withdrawals of `stdPerRetire` each were added to
 * the trailing window. Cloned, never committed.
 */
export function feeRateWithCrowd(world: World, retireCount: number, stdPerRetire: bigint): number {
  if (retireCount <= 0 || stdPerRetire <= 0n) return computeFeeRate(world);
  const clone: World = {
    ...world,
    withdrawWindow: [
      ...world.withdrawWindow,
      ...Array.from({ length: retireCount }, () => ({ ts: world.now, amount: stdPerRetire })),
    ],
  };
  return computeFeeRate(clone);
}

/**
 * The exit ticket for one branch, plus the crowded-door version of the same
 * ticket. `retireCount`/`stdPerRetire` drive the what-if only.
 */
export function exitImpact(
  world: World,
  charterId: string,
  branchId: number,
  retireCount = 0,
  stdPerRetire?: bigint,
): ExitImpact | null {
  const charter = world.charters[charterId];
  const quote = quoteRetirement(world, charterId, branchId);
  if (!charter || !quote) return null;

  const burn = quote.fee / 2n;
  const liveCount = charter.branches.filter((b) => b.alive).length;

  return {
    W: trailingWithdrawn(world),
    D: totalLedger(world),
    feeRateNow: quote.feeRate,
    feeRateIfRetireLvl: feeRateWithCrowd(world, retireCount, stdPerRetire ?? quote.mintToUser),
    burn,
    // The half that is not burned is rebated to the branches that stayed;
    // with no stayers left it burns too, which is why it is reported here as
    // rebate only when there is somebody to receive it.
    rebate: liveCount > 1 ? quote.fee - burn : 0n,
    mintToUser: quote.mintToUser,
    lastBranch: liveCount <= 1,
  };
}
