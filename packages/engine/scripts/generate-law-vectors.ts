// Generates shared test vectors from the live TS engine so
// contracts/law/test/LawMath.t.sol can assert the Solidity twin agrees with
// the actual engine code path, not a hand-copied formula. Run via
// `pnpm --filter @standard-law/engine gen:law-vectors` from the repo root.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { dutchPrice } from "../src/auctions.js";
import { feeRateFromP } from "../src/exits.js";
import { contractionSpend } from "../src/epoch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../contracts/law/test/vectors");

const WAD = 10n ** 18n;
const DAY = 86_400;

function wad(x: number): bigint {
  return BigInt(Math.round(x * 1e18));
}

// --- dutchPrice --------------------------------------------------------
// pStart/pFloor/elapsedSec triples spanning t=0, t=DAY, mid-decay,
// pFloor=0 (the engine's 1e-12-ratio-floor path), and a flat auction
// (pFloor == pStart).
const dutchCases: Array<[bigint, bigint, number]> = [
  [100n * WAD, 10n * WAD, 0],
  [100n * WAD, 10n * WAD, DAY],
  [100n * WAD, 10n * WAD, DAY / 2],
  [100n * WAD, 10n * WAD, DAY / 4],
  [3138n * WAD + 5n * 10n ** 16n, 1569n * WAD, 3600],
  [1n * WAD, 0n, 43_200],
  [50n * WAD, 50n * WAD, 20_000], // flat: floor == start
  [7n * WAD, 1n * WAD, 12_345],
  [2_000_000n * WAD, 100_000n * WAD, 70_000],
];

// Parallel arrays, not an array of objects: Foundry's vm.parseJson struct
// decoding requires struct fields in alphabetical order to match its JSON
// key normalization, which is a footgun. Parallel arrays read via
// vm.parseJsonUintArray sidestep it entirely.
const dutchVectors = {
  pStart: dutchCases.map(([pStart]) => pStart.toString()),
  pFloor: dutchCases.map(([, pFloor]) => pFloor.toString()),
  elapsedSec: dutchCases.map(([, , elapsedSec]) => elapsedSec),
  expected: dutchCases.map(([pStart, pFloor, elapsedSec]) => dutchPrice(pStart, pFloor, elapsedSec).toString()),
};

// --- resolutionFeeRate (feeRateFromP) -----------------------------------
const feeCases: Array<[number, number, number]> = [
  [0.01, 0.35, 0],
  [0.01, 0.35, 1],
  [0.01, 0.35, 0.5],
  [0.01, 0.35, 0.25],
  [0.02, 0.5, 0.1],
  [0.0, 1.0, 0.75],
  [0.05, 0.05, 0.5], // floor == ceil
];

const feeVectors = {
  feeFloorWad: feeCases.map(([feeFloor]) => wad(feeFloor).toString()),
  feeCeilWad: feeCases.map(([, feeCeil]) => wad(feeCeil).toString()),
  pWad: feeCases.map(([, , P]) => wad(P).toString()),
  expected: feeCases.map(([feeFloor, feeCeil, P]) => wad(feeRateFromP(feeFloor, feeCeil, P)).toString()),
};

// --- contractionSpend ----------------------------------------------------
const spendCases: Array<[bigint, bigint]> = [
  [0n, 100n * WAD],
  [10n * WAD, 0n],
  [10n * WAD, 100n * WAD], // vault-bound: 10% of 10 = 1 < 0.2% of 100 = 0.2? check below
  [1000n * WAD, 100n * WAD], // pool-bound
  [WAD / 1000n, WAD / 1000n],
];

const spendVectors = {
  vaultEth: spendCases.map(([vaultEth]) => vaultEth.toString()),
  poolEthReserve: spendCases.map(([, poolEthReserve]) => poolEthReserve.toString()),
  expected: spendCases.map(([vaultEth, poolEthReserve]) => contractionSpend(vaultEth, poolEthReserve).toString()),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "dutch-price.json"), JSON.stringify(dutchVectors, null, 2));
writeFileSync(path.join(OUT_DIR, "resolution-fee.json"), JSON.stringify(feeVectors, null, 2));
writeFileSync(path.join(OUT_DIR, "contraction-spend.json"), JSON.stringify(spendVectors, null, 2));

console.log(
  `Wrote ${dutchCases.length} dutchPrice, ${feeCases.length} feeRate, ${spendCases.length} contractionSpend vectors to ${OUT_DIR}`,
);
