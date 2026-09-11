// The tape: a bounded, append-only log of what actually moved the World.
// Lab, Desk and Sentinel all read the same row shape. Rows are derived from a
// before/after diff rather than trusted from the caller, so the numbers are
// right even when a call site forgets to label itself.
import type { Regime, World } from "./types.js";

export const TAPE_CAP = 200;

export interface TapeRow {
  t: number;
  op: string;
  /** ETH into the pool attributable to this op (omitted when an epoch closed mid-op). */
  ethIn?: string;
  ethOut?: string;
  /** Net flow of the epoch in progress after this op: ethInEpoch - ethOutEpoch. */
  Fn?: string;
  /** Regime the epoch in progress would close into — not the last closed epoch's badge. */
  regime?: Regime;
  note?: string;
}

/** Net flow of the epoch currently in progress. */
export function liveNetFlow(world: World): bigint {
  return world.ethInEpoch - world.ethOutEpoch;
}

/** Regime the in-progress epoch would close into right now (zero counts as contraction). */
export function regimeIfEpochEndedNow(world: World): Regime {
  return liveNetFlow(world) > 0n ? "expansion" : "contraction";
}

/** Regime shown on the badge: the last epoch that actually closed. */
export function regimeNow(world: World): Regime {
  const last = world.F.length > 0 ? world.F[world.F.length - 1] : 0n;
  return last > 0n ? "expansion" : "contraction";
}

export function tapeRowFrom(before: World, after: World, op: string): TapeRow {
  const row: TapeRow = {
    t: after.now,
    op,
    Fn: liveNetFlow(after).toString(),
    regime: regimeIfEpochEndedNow(after),
  };

  // Per-op ETH deltas only mean something inside one epoch; a close resets the
  // counters, so report the close instead of a bogus negative delta.
  if (after.epoch === before.epoch) {
    const inDelta = after.ethInEpoch - before.ethInEpoch;
    const outDelta = after.ethOutEpoch - before.ethOutEpoch;
    if (inDelta !== 0n) row.ethIn = inDelta.toString();
    if (outDelta !== 0n) row.ethOut = outDelta.toString();
  } else {
    row.note = `closed epoch ${before.epoch} -> ${after.epoch}`;
  }

  if (after.lastError) row.note = row.note ? `${row.note}; ${after.lastError}` : after.lastError;
  return row;
}

/** Append with the 200-row cap applied. Returns a new array; never mutates. */
export function appendTape(tape: TapeRow[], row: TapeRow): TapeRow[] {
  const next = tape.length >= TAPE_CAP ? tape.slice(tape.length - TAPE_CAP + 1) : tape.slice();
  next.push(row);
  return next;
}
