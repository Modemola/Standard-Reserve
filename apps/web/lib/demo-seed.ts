// Spec §10 — the demo world: /bank/0042 must not be an empty shell on first load.
import { DEFAULT_PARAMS, applySwap, buyLicense, createWorld, seedGenesis, tick } from "@standard-law/engine";
import type { World } from "@standard-law/engine";

export const DEMO_CHARTER_ID = "c-0042";

export function buildDemoWorld(): World {
  let world = createWorld(DEFAULT_PARAMS, 0);
  world = seedGenesis(world, 200); // c-0001 .. c-0200

  // Two simulated epochs of inflow so ledgers aren't all zero on first load.
  world = applySwap(world, "buyStd", 50n * 10n ** 18n);
  world = tick(world, DEFAULT_PARAMS.epochSeconds);
  world = applySwap(world, "buyStd", 30n * 10n ** 18n);
  world = tick(world, DEFAULT_PARAMS.epochSeconds);

  // c-0042 grows from its genesis branch to 7 live, staggered branches.
  // maxLicensesPerCharterPerDay caps this at 3/day, so roll a day forward
  // every third purchase (mirrors packages/engine/test/branches.test.ts).
  for (let i = 0; i < 6; i++) {
    if (i > 0 && i % 3 === 0) world = tick(world, 86_400);
    world = buyLicense(world, DEMO_CHARTER_ID);
    world = tick(world, 3600);
  }

  // A last day of net inflow *before* the epoch closes.
  //
  // Without this the demo world's most recently closed epoch had F_n = 0, and
  // zero is contraction by spec -- so every route, every screenshot and the
  // product shot all opened on a red CONTRACTION badge and the gold half of
  // the design was never seen. Worse, it made the Phase B exit test
  // ("loading exodus flips the regime to contraction") assert a state that was
  // already true before the action: it would have passed if the scenario
  // loader did nothing at all.
  //
  // This is a demo seed, not a claim -- the world already simulates two epochs
  // of trading to give the ledgers something in them.
  world = applySwap(world, "buyStd", 12n * 10n ** 18n);

  // Roll into a fresh day so c-0042's daily license quota (just maxed above)
  // is open again when the demo loads, and the auction below reads as "today".
  world = tick(world, 86_400);

  // A little flow in the *open* epoch too, so "net flow this epoch" reads as a
  // live number rather than a flat 0.0000 on first paint.
  world = applySwap(world, "buyStd", 3n * 10n ** 18n);

  // Fill the day's license auction to ~37 sold (mid-curve) across other charters.
  const otherIds = Object.keys(world.charters).filter((id) => id !== DEMO_CHARTER_ID);
  for (const id of otherIds) {
    if (world.licenseAuction.sold >= 37) break;
    world = buyLicense(world, id);
  }

  return world;
}
