// WP §5 — base issuance. I_n = baseDaily * epochDays * m_n, streamed
// continuously across live branches and capped by the 900M ISSUANCE_BUDGET.
import { ISSUANCE_BUDGET, DAY_SECONDS } from "./constants.js";
import type { Branch, World } from "./types.js";

const M_FIXED_SCALE = 1_000_000n;

/** I_n for the epoch currently in progress, using the epoch's locked-in m. */
export function computeEpochIssuance(world: World): bigint {
  const { params } = world;
  const baseDailyPerEpoch =
    (params.baseDailyStd * BigInt(params.epochSeconds)) / BigInt(DAY_SECONDS);
  const mFixed = BigInt(Math.round(world.m * Number(M_FIXED_SCALE)));
  return (baseDailyPerEpoch * mFixed) / M_FIXED_SCALE;
}

function liveBranches(world: World): Branch[] {
  const out: Branch[] = [];
  for (const charter of Object.values(world.charters)) {
    if (!charter.alive) continue;
    for (const branch of charter.branches) {
      // A branch only earns for ticks that start at or after it opened —
      // guarantees zero issuance for any time before openedAt.
      if (branch.alive && branch.openedAt <= world.now) out.push(branch);
    }
  }
  return out;
}

/** Stream this tick's share of I_n across currently-live branches, respecting the issuance budget. */
export function streamIssuance(world: World, dt: number): World {
  if (dt <= 0) return world;
  const I_n = computeEpochIssuance(world);
  const epochDuration = BigInt(world.params.epochSeconds);
  let tickTotal = (I_n * BigInt(dt)) / epochDuration;

  const remaining = ISSUANCE_BUDGET - world.issuanceCreditsCum;
  if (remaining <= 0n) return world;
  if (tickTotal > remaining) tickTotal = remaining;
  if (tickTotal <= 0n) return world;

  const eligible = liveBranches(world);
  if (eligible.length === 0) return world;

  const perBranch = tickTotal / BigInt(eligible.length);
  if (perBranch <= 0n) return world;

  for (const branch of eligible) {
    branch.ledger += perBranch;
  }
  world.issuanceCreditsCum += perBranch * BigInt(eligible.length);
  return world;
}
