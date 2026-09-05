#!/usr/bin/env tsx
// Run the adversarial probes and report what, if anything, each one extracts.
//
//   pnpm --filter @standard-law/engine run attack
//   pnpm --filter @standard-law/engine run attack --days 120
import { DEFAULT_PARAMS } from "../src/params.js";
import { STRATEGIES, runAttack } from "../src/adversary.js";

const argv = process.argv.slice(2);
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const days = Number(flag("days") ?? 90);

const WAD = 1e18;
const eth = (v: bigint) => (Number(v) / WAD).toFixed(4);
const std = (v: bigint) => (Number(v) / WAD).toLocaleString(undefined, { maximumFractionDigits: 0 });
const tty = process.stdout.isTTY;
const paint = (s: string, c: string) => (tty ? `[${c}m${s}[0m` : s);

console.log(`\nAdversarial probes — ${days} simulated days, default params.`);
console.log("Every strategy is measured against a passive control in the same world.\n");

for (const name of Object.keys(STRATEGIES)) {
  if (name === "passive") continue;
  const r = runAttack(DEFAULT_PARAMS, name, days);

  console.log(paint(r.strategy, "1;33"));
  console.log(`  ${r.question}`);
  console.log(`    ETH spent        ${eth(r.ledger.ethSpent).padStart(14)}`);
  console.log(`    ETH received     ${eth(r.ledger.ethReceived).padStart(14)}`);
  console.log(`    STD minted       ${std(r.ledger.stdMinted).padStart(14)}`);
  console.log(`    STD paid (lic.)  ${std(r.ledger.stdPaidForLicences).padStart(14)}`);
  console.log(`    STD in branches  ${std(r.ledger.stdInBranches).padStart(14)}`);
  console.log(`    net              ${eth(r.netEth).padStart(14)} ETH   ${std(r.netStd).padStart(16)} STD`);
  console.log(`    passive control  ${eth(r.controlNetEth).padStart(14)} ETH   ${std(r.controlNetStd).padStart(16)} STD`);

  const better = r.edgeStd > 0n;
  const label = better ? paint("EDGE OVER PASSIVE", "31") : paint("no edge", "32");
  console.log(
    `    ${label}: ${eth(r.edgeEth)} ETH, ${std(r.edgeStd)} STD` +
      `\n    m peak ${r.peakM.toFixed(2)} / mean ${r.meanM.toFixed(2)}` +
      `  vs control peak ${r.controlPeakM.toFixed(2)} / mean ${r.controlMeanM.toFixed(2)}\n`,
  );
}

// The pump is unprofitable at the default pool depth, but that is a statement
// about the pool rather than about the policy rule. 100 ETH against 100M STD
// means an 80 ETH round trip pays enormous slippage, and the slippage -- not
// the m rule -- is what makes the attack lose. Deepen the pool and the same
// strategy gets cheaper to run while the issuance it unlocks stays the same
// size, so the honest way to report "no edge" is to say what would change it.
console.log(paint("pool-depth sensitivity of pump_and_harvest", "1;33"));
console.log("  Slippage is the defence here, not the policy. How deep would the pool");
console.log("  have to be before manufacturing the signal starts paying for itself?\n");
console.log("    genesisEth   round-trip loss      STD edge   edge/ETH spent");
for (const genesisEth of [100, 1_000, 10_000, 100_000]) {
  const params = { ...DEFAULT_PARAMS, genesisEth: BigInt(genesisEth) * 10n ** 18n };
  const r = runAttack(params, "pump_and_harvest", days);
  const spent = Number(r.ledger.ethSpent) / WAD;
  const lossPct = spent > 0 ? (Number(-r.netEth) / WAD / spent) * 100 : 0;
  const perEth = spent > 0 ? Number(r.edgeStd) / WAD / spent : 0;
  console.log(
    `    ${String(genesisEth).padStart(9)}   ${lossPct.toFixed(1).padStart(13)}%   ` +
      `${std(r.edgeStd).padStart(11)}   ${perEth.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(14)} STD`,
  );
}
console.log(
  "\n  Read this as: the round-trip cost falls as the pool deepens while the",
);
console.log(
  "  issuance edge does not, so the attack's viability is a property of",
);
console.log(
  "  liquidity depth. Nothing here is a claim about the real protocol -- the",
);
console.log(
  "  pool seed is a simulator constant, not a published one.\n",
);
