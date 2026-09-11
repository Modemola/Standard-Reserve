export * from "./types.js";
export * from "./constants.js";
export { DEFAULT_PARAMS, DEFAULT_RAW_PARAMS, loadParams, loadParamsWithOverlay } from "./params.js";

// Low-level primitives useful to the UI beyond the store's action wrappers.
export { buyStd, sellStd, initPool, spotPriceEthPerStd } from "./pool.js";
export { dutchPrice, licenseFloor, quoteLicensePrice, quoteCharterPrice } from "./auctions.js";
export { computeEpochIssuance } from "./issuance.js";
export { computeFeeRate, feeRateFromP } from "./exits.js";
export { contractionSpend } from "./epoch.js";
export { supplyCirc, supplyMax } from "./invariants.js";

// Tape (shared row shape for Lab / Desk / Sentinel) and optional instrumentation.
export {
  TAPE_CAP,
  appendTape,
  liveNetFlow,
  regimeIfEpochEndedNow,
  regimeNow,
  tapeRowFrom,
} from "./tape.js";
export type { TapeRow } from "./tape.js";
export { createTrace } from "./trace.js";
export type { BuybackTick, EngineTrace } from "./trace.js";

// Time-driven policy internals Sentinel needs to drive the engine directly.
export { advancePolicy, runContractionBuyback } from "./epoch.js";
export { rollAuctionsIfNeeded } from "./auctions.js";

// Public action API (createWorld, tick, applySwap, buyLicense, buyCharter,
// retireBranch, checkIn, reportDormant, closeEpochIfDue, quoteRetirement,
// quoteLicense, invariantCheck, hashWorld, SimStore).
export * from "./store.js";
export * from "./sweep.js";
export * from "./adversary.js";
