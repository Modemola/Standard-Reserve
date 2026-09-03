// WP §3 — supply identities and general sanity checks, run after every op.
import { GENESIS_POL, HARD_CAP, ISSUANCE_BUDGET } from "./constants.js";
import type { InvariantResult, World } from "./types.js";

export function supplyCirc(world: World): bigint {
  return GENESIS_POL + world.M - world.B;
}

export function supplyMax(world: World): bigint {
  return HARD_CAP - world.B;
}

export function invariantCheck(world: World): InvariantResult {
  const failures: string[] = [];

  if (world.M < 0n) failures.push("M < 0");
  if (world.B < 0n) failures.push("B < 0");
  if (world.issuanceCreditsCum < 0n) failures.push("issuanceCreditsCum < 0");
  if (world.issuanceCreditsCum > ISSUANCE_BUDGET) {
    failures.push("issuanceCreditsCum exceeds ISSUANCE_BUDGET");
  }
  if (world.M > ISSUANCE_BUDGET + world.issuanceCreditsCum) {
    // Generous bound: mints beyond streamed issuance can only come from
    // dormancy bounties / rebates, which are small relative to the budget.
    failures.push("M implausibly exceeds issued + bounty budget");
  }

  const circ = supplyCirc(world);
  const max = supplyMax(world);
  if (circ > max) failures.push("S_circ exceeds S_max");
  if (max > HARD_CAP) failures.push("S_max exceeds HARD_CAP");

  if (world.pool.eth < 0n || world.pool.std < 0n) failures.push("pool reserve negative");
  if (world.pool.eth === 0n || world.pool.std === 0n) failures.push("pool reserve drained to zero");

  if (world.vaults.expansionEth < 0n) failures.push("expansionEth < 0");
  if (world.vaults.expansionGold < 0n) failures.push("expansionGold < 0");
  if (world.vaults.contractionEth < 0n) failures.push("contractionEth < 0");
  if (world.polEth < 0n) failures.push("polEth < 0");
  if (world.polStd < 0n) failures.push("polStd < 0");
  if (world.teamEth < 0n) failures.push("teamEth < 0");
  if (world.feeBucketEth < 0n) failures.push("feeBucketEth < 0");

  for (const charter of Object.values(world.charters)) {
    if (charter.branches.length !== world.params.maxBranches) {
      failures.push(`charter ${charter.id} has wrong branch slot count`);
    }
    if (!charter.alive && charter.branches.some((b) => b.alive)) {
      failures.push(`charter ${charter.id} is dead but has live branches`);
    }
    for (const branch of charter.branches) {
      if (branch.ledger < 0n) failures.push(`charter ${charter.id} branch ${branch.id} ledger < 0`);
    }
  }

  return { ok: failures.length === 0, failures };
}
