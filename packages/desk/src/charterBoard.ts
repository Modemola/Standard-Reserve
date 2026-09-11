// WP §8 — the charter book. With the daily cap at zero there is no market at
// all, and the UI must show a tombstone rather than tease a price.
import { dutchPrice } from "@standard-law/engine";
import type { World } from "@standard-law/engine";

export interface CharterBoard {
  open: boolean;
  cap: number;
  sold: number;
  /** Only present when the book is genuinely open. Never render a price without it. */
  pNow?: bigint;
  pFloor?: bigint;
  pLast?: bigint;
}

export function charterBoard(world: World): CharterBoard {
  const a = world.charterAuction;
  if (a.cap <= 0 || world.params.charterDailyCap <= 0) {
    return { open: false, cap: 0, sold: a.sold };
  }
  return {
    open: true,
    cap: a.cap,
    sold: a.sold,
    pNow: dutchPrice(a.pStart, a.pFloor, world.now - a.opensAt),
    pFloor: a.pFloor,
    pLast: a.pLast,
  };
}
