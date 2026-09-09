// WP §4 — what it costs, in ETH, to change the sign of this epoch's net flow.
import { liveNetFlow, regimeIfEpochEndedNow, regimeNow } from "@standard-law/engine";
import type { Regime, World } from "@standard-law/engine";

export interface FlipQuote {
  /** Net flow of the epoch in progress: ethInEpoch - ethOutEpoch. */
  Fn: bigint;
  /** ETH of net inflow still needed to close expansion. 0 if already there. */
  ethToFlipToExpansion: bigint;
  /** ETH of net outflow still needed to close contraction. 0 if already there. */
  ethToFlipToContraction: bigint;
  /** The badge: the last epoch that actually closed. */
  regimeNow: Regime;
  /** Where the epoch in progress is pointing right now. */
  regimeIfEpochEndedNow: Regime;
}

/**
 * Zero net flow already counts as contraction, so flipping to expansion needs
 * strictly positive net — one wei more than closing the gap.
 */
export function flipQuote(world: World): FlipQuote {
  const Fn = liveNetFlow(world);
  return {
    Fn,
    ethToFlipToExpansion: Fn > 0n ? 0n : -Fn + 1n,
    ethToFlipToContraction: Fn > 0n ? Fn : 0n,
    regimeNow: regimeNow(world),
    regimeIfEpochEndedNow: regimeIfEpochEndedNow(world),
  };
}
