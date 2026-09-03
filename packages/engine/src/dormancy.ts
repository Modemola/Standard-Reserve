// WP dormancy section — heartbeat, check-in, and third-party revocation.
import type { World } from "./types.js";

export function checkIn(world: World, charterId: string): World {
  const charter = world.charters[charterId];
  if (charter && charter.alive) charter.lastInteraction = world.now;
  return world;
}

export interface ReportDormantResult {
  world: World;
  ok: boolean;
  reason?: string;
  bounty?: bigint;
  burned?: bigint;
}

/** Anyone may report a charter dormant once its heartbeat exceeds dormancySeconds. */
export function reportDormant(
  world: World,
  charterId: string,
  _reporterKey: string,
): ReportDormantResult {
  const charter = world.charters[charterId];
  if (!charter || !charter.alive) return { world, ok: false, reason: "unknown_charter" };

  const idleFor = world.now - charter.lastInteraction;
  if (idleFor < world.params.dormancySeconds) {
    return { world, ok: false, reason: "not_yet_dormant" };
  }

  let totalLedger = 0n;
  for (const branch of charter.branches) if (branch.alive) totalLedger += branch.ledger;

  const fee = bigintBps(totalLedger, world.params.revocationBps);
  const bountyRaw = bigintBps(fee, world.params.dormancyBountyBps);
  const bountyCap = world.params.dormancyBountyCapStd;
  const bounty = bountyRaw < bountyCap ? bountyRaw : bountyCap;
  const burn = fee - bounty;

  // The non-fee remainder of the ledger (1 - revocationBps) was never minted
  // to anyone: the owner abandoned it, so it is simply not credited.
  world.B += burn;
  world.M += bounty;
  world.withdrawWindow.push({ ts: world.now, amount: bounty });

  for (const branch of charter.branches) {
    branch.alive = false;
    branch.ledger = 0n;
  }
  charter.alive = false;

  return { world, ok: true, bounty, burned: burn };
}

function bigintBps(v: bigint, bps: number): bigint {
  return (v * BigInt(bps)) / 10_000n;
}
