// Spec §13 — engine/UI function to whitepaper section mapping.
export const LAW_MAPPING = [
  { engine: "S_circ / S_max", wp: "§3 (3.1) (3.2)", notes: "invariants.ts — supplyCirc / supplyMax" },
  { engine: "F_n, signal", wp: "§4 (4.1)", notes: "epoch.ts — closeOneEpoch" },
  { engine: "I_n, m", wp: "§5", notes: "issuance.ts, epoch.ts — computeEpochIssuance / updateM" },
  { engine: "charter lifecycle", wp: "§6", notes: "auctions.ts — createCharter, buyCharter" },
  { engine: "licenses, P(t)", wp: "§7 (7.1)", notes: "auctions.ts — dutchPrice, buyLicense" },
  { engine: "Dutch open 2× / 3×", wp: "§8", notes: "auctions.ts — rollOneDay" },
  { engine: "resolution fee", wp: "§9 (9.1)", notes: "exits.ts — computeFeeRate, feeRateFromP, retireBranch" },
  { engine: "dormancy", wp: "dormancy section", notes: "dormancy.ts — checkIn, reportDormant" },
  {
    engine: "70/15/15, spend_tick",
    wp: "§11 (11.1)",
    notes: "epoch.ts — splitFees; runContractionBuyback, contractionSpend",
  },
] as const;

// Phase 2 — Sentinel attack fixtures, mapped to the rule each one leans on.
export const LAW_MAPPING_SENTINEL = [
  { engine: "A1 wash / F_n", wp: "§4 (4.1)", notes: "volume is not flow: a round trip nets to zero" },
  { engine: "A2 issuance lag", wp: "§5", notes: "signal is built from F_{n-1}+F_{n-2}, not the epoch being pumped" },
  { engine: "A3 split raise", wp: "§5", notes: "CHEAP — a raise is a sign test, not a size test; see `pnpm attack` for what a sustained version costs" },
  { engine: "A4 spend_tick", wp: "§11 (11.1)", notes: "every buyback hour capped at min(10% vault, 0.2% pool)" },
  { engine: "A5 regime jitter", wp: "§4 (4.1)", notes: "CHEAP — one wei at the bell decides which vault takes 70% of fee income, and whether m is cut" },
  { engine: "A6 / A7 licences", wp: "§7-8", notes: "3/day per charter, 10 branches, payment burns" },
  { engine: "A8 / A9 exits", wp: "§9", notes: "run tax rises with the crowd; rebate reaches the stayers only" },
  { engine: "A10 / A11 dormancy", wp: "dormancy section", notes: "30-day window; check-in resets the heartbeat" },
  { engine: "A12 POL", wp: "§11", notes: "POL only grows — the engine has no withdrawal path" },
  { engine: "A13 budget", wp: "§3", notes: "base issuance stops at the 900M credit cap; fees keep flowing" },
  { engine: "A14 gold oracle", wp: "§11", notes: "CHEAP — ethPerGoldGram is declared but unwired, so the gold column is not a reserve claim" },
] as const;

// Phase 2 — Open Market Desk quotes, all pure functions over a cloned World.
export const LAW_MAPPING_DESK = [
  { engine: "flipQuote", wp: "§4 sign(F_n)", notes: "desk/flip.ts — ETH needed to change the epoch's sign" },
  { engine: "licensePlans", wp: "§7 (7.1) P(t)", notes: "desk/licensePlans.ts — now / wait / floor, priced on clones" },
  { engine: "charterBoard", wp: "§8 3x / cap 0", notes: "desk/charterBoard.ts — a closed book shows no price at all" },
  { engine: "exitImpact", wp: "§9 (9.1)", notes: "desk/exitImpact.ts — run tax now, and with a crowded door" },
] as const;

// Phase E — audit-narrative Solidity twins of three of the above pure
// formulas. Never deployed (see docs/ARCHITECTURE.md §0 non-goals).
export const LAW_MAPPING_SOLIDITY = [
  {
    solidity: "dutchPrice",
    engine: "auctions.ts — dutchPrice",
    notes: "Not bit-exact: PRBMath fixed-point pow vs. the engine's IEEE-754 Math.pow. Vectors assert a relative tolerance.",
  },
  {
    solidity: "resolutionFeeRate",
    engine: "exits.ts — feeRateFromP",
    notes: "Same formula, WAD fixed-point vs. JS doubles — tight relative tolerance, not exact.",
  },
  {
    solidity: "contractionSpend",
    engine: "epoch.ts — contractionSpend",
    notes: "Pure integer arithmetic in both languages at the same WAD scale — exact match.",
  },
] as const;
