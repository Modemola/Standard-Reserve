// Optional engine instrumentation. A trace is a passive sink: passing one to
// tick() records what the time-driven policy did, without changing any
// behaviour and without touching World (so hashWorld stays stable and every
// existing caller keeps its hashes). Sentinel uses this to assert the
// per-hour contraction buyback bound; nothing in the UI depends on it.

/** One hourly contraction buyback, as it actually executed. */
export interface BuybackTick {
  /** world.now at the moment this buyback hour was processed. */
  t: number;
  vaultBefore: bigint;
  poolEthBefore: bigint;
  /** ETH taken out of the contraction vault — must equal contractionSpend(vaultBefore, poolEthBefore). */
  spend: bigint;
  /** $STANDARD bought and burned with that spend. */
  burned: bigint;
}

export interface EngineTrace {
  buybacks: BuybackTick[];
}

export function createTrace(): EngineTrace {
  return { buybacks: [] };
}
