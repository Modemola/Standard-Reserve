// Spec §13 — engine/UI function to whitepaper section mapping.
export const LAW_MAPPING = [
  { engine: "S_circ / S_max", wp: "§3 (3.1) (3.2)", notes: "invariants.ts — supplyCirc / supplyMax" },
  { engine: "F_n, signal", wp: "§4 (4.1)", notes: "epoch.ts — closeOneEpoch" },
  { engine: "I_n, m", wp: "§5", notes: "issuance.ts, epoch.ts — computeEpochIssuance / updateM" },
  { engine: "charter lifecycle", wp: "§6", notes: "auctions.ts — createCharter, buyCharter" },
  { engine: "licenses, P(t)", wp: "§7 (7.1)", notes: "auctions.ts — dutchPrice, buyLicense" },
  { engine: "Dutch open 2× / 3×", wp: "§8", notes: "auctions.ts — rollOneDay" },
  { engine: "resolution fee", wp: "§9 (9.1)", notes: "exits.ts — computeFeeRate, retireBranch" },
  { engine: "dormancy", wp: "dormancy section", notes: "dormancy.ts — checkIn, reportDormant" },
  { engine: "70/15/15, spend_tick", wp: "§11 (11.1)", notes: "epoch.ts — splitFees; runContractionBuyback" },
] as const;
