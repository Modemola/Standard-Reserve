// WP §4-5, §11 — epoch close (flow/signal/m), fee split, POL growth, and the
// hourly contraction buyback.
import { HOUR_SECONDS } from "./constants.js";
import { buyStd } from "./pool.js";
import { rollAuctionsIfNeeded } from "./auctions.js";
import type { EngineTrace } from "./trace.js";
import type { Regime, World } from "./types.js";

const MAX_CATCHUP_STEPS = 2_000;

function regimeOf(F_n: bigint): Regime {
  return F_n > 0n ? "expansion" : "contraction";
}

function updateM(world: World, F_n: bigint, signal_n: bigint): void {
  const { mMin, mMax, cutStep, raiseStep } = world.params;
  if (F_n <= 0n) {
    world.m = Math.max(mMin, world.m - cutStep);
  } else if (signal_n > 0n && F_n > 0n) {
    world.m = Math.min(mMax, world.m + raiseStep);
  }
}

function splitFees(world: World, regime: Regime): void {
  const income = world.feeBucketEth;
  if (income <= 0n) return;

  const toVault = (income * 70n) / 100n;
  const toPol = (income * 15n) / 100n;
  const toTeam = income - toVault - toPol; // remainder absorbs rounding dust

  if (regime === "expansion") world.vaults.expansionEth += toVault;
  else world.vaults.contractionEth += toVault;

  world.teamEth += toTeam;

  // Half the POL share buys $STANDARD at the sim AMM price and pairs with
  // the other half; both legs only ever grow (POL liquidity never decreases).
  const polEthHalf = toPol / 2n;
  const polSwapHalf = toPol - polEthHalf;
  if (polSwapHalf > 0n) {
    const { pool, amountOut } = buyStd(world.pool, polSwapHalf, 0);
    world.pool = pool;
    world.polStd += amountOut;
  }
  world.polEth += polEthHalf;

  world.feeBucketEth = 0n;
}

function closeOneEpoch(world: World): void {
  const F_n = world.ethInEpoch - world.ethOutEpoch;
  world.F.push(F_n);

  const idx = world.F.length - 1; // index of the epoch we just closed
  const prev1 = idx - 1 >= 0 ? world.F[idx - 1] : 0n;
  const prev2 = idx - 2 >= 0 ? world.F[idx - 2] : 0n;
  const signal_n = prev1 + prev2;

  splitFees(world, regimeOf(F_n));
  updateM(world, F_n, signal_n);

  world.ethInEpoch = 0n;
  world.ethOutEpoch = 0n;
  world.epoch += 1;
  world.epochStartedAt += world.params.epochSeconds;
}

/** Close as many epochs as have elapsed since epochStartedAt (handles large time jumps). */
export function closeEpochIfDue(world: World): World {
  let steps = 0;
  while (
    world.now >= world.epochStartedAt + world.params.epochSeconds &&
    steps < MAX_CATCHUP_STEPS
  ) {
    closeOneEpoch(world);
    steps += 1;
  }
  return world;
}

/** spend = min(10% of vaultEth, 0.2% of poolEthReserve). */
export function contractionSpend(vaultEth: bigint, poolEthReserve: bigint): bigint {
  const tenPctVault = vaultEth / 10n;
  const twentyBpsPool = (poolEthReserve * 2n) / 1000n;
  return tenPctVault < twentyBpsPool ? tenPctVault : twentyBpsPool;
}

function contractionBuybackOnce(world: World, trace?: EngineTrace): void {
  const vault = world.vaults.contractionEth;
  if (vault <= 0n || world.pool.eth <= 0n) return;
  const poolEthBefore = world.pool.eth;
  const spend = contractionSpend(vault, poolEthBefore);
  if (spend <= 0n) return;

  const { pool, amountOut } = buyStd(world.pool, spend, 0);
  world.pool = pool;
  world.vaults.contractionEth -= spend;
  world.B += amountOut; // buyback burns 100% of the $STANDARD purchased

  trace?.buybacks.push({
    t: world.lastBuybackAt + HOUR_SECONDS,
    vaultBefore: vault,
    poolEthBefore,
    spend,
    burned: amountOut,
  });
}

/** Run the hourly contraction buyback for every whole hour elapsed since the last run. */
export function runContractionBuyback(world: World, trace?: EngineTrace): World {
  let steps = 0;
  while (world.now - world.lastBuybackAt >= HOUR_SECONDS && steps < MAX_CATCHUP_STEPS) {
    contractionBuybackOnce(world, trace);
    world.lastBuybackAt += HOUR_SECONDS;
    steps += 1;
  }
  return world;
}

/**
 * Advance all time-driven policy: epoch close, then auctions, then buyback.
 * Epoch close must run first — it updates world.m for the epoch that just
 * ended, and rollAuctionsIfNeeded prices the new day's license floor off
 * that m. Rolling auctions before the epoch closes would price tomorrow's
 * floor off yesterday's (stale) multiplier.
 */
export function advancePolicy(world: World, trace?: EngineTrace): World {
  world.day = Math.floor(world.now / 86_400);
  closeEpochIfDue(world);
  rollAuctionsIfNeeded(world);
  runContractionBuyback(world, trace);
  return world;
}
