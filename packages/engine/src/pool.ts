// WP §4.4 — constant-product AMM. Fee lives on the ETH leg and is routed to
// the epoch fee bucket, not added back to reserves (v1 simplification: no
// direct LP fee accrual outside the 15% POL path at epoch close).
import { BPS_DENOM } from "./constants.js";
import type { Pool } from "./types.js";

export interface SwapResult {
  pool: Pool;
  amountOut: bigint;
  fee: bigint;
}

export function initPool(genesisStd: bigint, genesisEth: bigint): Pool {
  return { eth: genesisEth, std: genesisStd };
}

/**
 * Divide rounding up. The reserve left in the pool is always computed with
 * this, never with bigint's truncating `/`: flooring the remaining reserve
 * hands the rounding dust to the trader and lets the constant product erode
 * a little on every single swap. Rounding the *remaining* side up keeps
 * k non-decreasing, which is the invariant an AMM actually rests on.
 */
function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

export function spotPriceEthPerStd(pool: Pool): number {
  if (pool.std === 0n) return 0;
  return Number(pool.eth) / Number(pool.std);
}

/** Buy $STANDARD with ETH. `ethIn` is the gross amount the trader pays. */
export function buyStd(pool: Pool, ethIn: bigint, feeBps: number): SwapResult {
  if (ethIn <= 0n) return { pool, amountOut: 0n, fee: 0n };
  const fee = (ethIn * BigInt(feeBps)) / BPS_DENOM;
  const ethInNet = ethIn - fee;
  const newEth = pool.eth + ethInNet;
  const newStd = ceilDiv(pool.eth * pool.std, newEth);
  const stdOut = pool.std - newStd;
  return { pool: { eth: newEth, std: newStd }, amountOut: stdOut, fee };
}

/** Sell $STANDARD for ETH. Fee is taken off the ETH leaving the pool. */
export function sellStd(pool: Pool, stdIn: bigint, feeBps: number): SwapResult {
  if (stdIn <= 0n) return { pool, amountOut: 0n, fee: 0n };
  const newStd = pool.std + stdIn;
  const newEth = ceilDiv(pool.eth * pool.std, newStd);
  const ethOutGross = pool.eth - newEth;
  const fee = (ethOutGross * BigInt(feeBps)) / BPS_DENOM;
  const ethOut = ethOutGross - fee;
  return { pool: { eth: newEth, std: newStd }, amountOut: ethOut, fee };
}
