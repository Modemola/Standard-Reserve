#!/usr/bin/env tsx
// Run a parameter sweep and print where the policy degenerates.
//
//   pnpm sweep                          # default grid, all three workloads
//   pnpm sweep --workload choppy        # one workload
//   pnpm sweep --days 120 --json out.json
//
// This is only the reporting shell. All the reasoning lives in
// packages/engine/src/sweep.ts, so a test, this script and the app can drive
// the same sweep without three copies of the rules.
import { writeFileSync } from "node:fs";
import { DEFAULT_PARAMS } from "../src/params.js";
import { VERDICT_MEANING, WORKLOADS, runSweep } from "../src/sweep.js";
import type { Params } from "../src/types.js";
import type { Verdict } from "../src/sweep.js";

const argv = process.argv.slice(2);
function flag(name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

const horizonDays = Number(flag("days") ?? 90);
const seed = Number(flag("seed") ?? 1);
const only = flag("workload");
const jsonOut = flag("json");
const seeds = Number(flag("seeds") ?? 5);

// The two axes that actually decide whether issuance regulates anything: how
// far m is allowed to travel, and how hard a bad epoch cuts it.
const AXES: { param: keyof Params; values: number[] }[] = [
  { param: "mMax", values: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] },
  { param: "cutStep", values: [0.05, 0.1, 0.25, 0.5, 0.75] },
];

const SHORT: Record<Verdict, string> = {
  invariant_break: "  BREAK",
  budget_exhausted: " budget",
  cut_never_bit: " nocut!",
  issuance_dead: "   dead",
  issuance_pinned: " pinned",
  pol_stalled: "  noPOL",
  policy_inert: "  inert",
};

const tty = process.stdout.isTTY;
const paint = (s: string, c: string) => (tty ? `[${c}m${s}[0m` : s);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

const workloads = only ? [WORKLOADS[only]] : Object.values(WORKLOADS);
if (workloads.some((w) => !w)) {
  console.error(`Unknown workload. Available: ${Object.keys(WORKLOADS).join(", ")}`);
  process.exit(1);
}

const results = [];
for (const workload of workloads) {
  const result = runSweep({ base: DEFAULT_PARAMS, axes: AXES, workload, horizonDays, seed, seeds });
  results.push(result);

  console.log(`\n${paint(workload.name, "1;33")} — ${workload.description}`);
  console.log(
    `  ${result.cells.length} cells x ${seeds} seeds, ${horizonDays}d each, from seed ${seed}` +
      (result.skipped ? ` (${result.skipped} invalid combinations skipped)` : ""),
  );

  const [rowAxis, colAxis] = AXES;
  console.log(`\n  ${"".padEnd(11)}${paint(colAxis.param, "2")}`);
  console.log(`  ${rowAxis.param.padEnd(11)}${colAxis.values.map((v) => String(v).padStart(7)).join("")}`);
  for (const rv of rowAxis.values) {
    const row = colAxis.values
      .map((cv) => {
        const cell = result.cells.find(
          (c) => c.overrides[rowAxis.param] === rv && c.overrides[colAxis.param] === cv,
        );
        if (!cell) return "      ·";
        // Verdicts are already in severity order, so [0] is the worst.
        return cell.healthy ? paint("     ok", "32") : paint(SHORT[cell.verdicts[0]], "31");
      })
      .join("");
    console.log(`  ${String(rv).padEnd(11)}${row}`);
  }

  const share = result.cells.length ? result.healthyCount / result.cells.length : 0;
  console.log(`\n  ${result.healthyCount}/${result.cells.length} healthy (${pct(share)})`);

  const tally = new Map<Verdict, number>();
  for (const c of result.cells) for (const v of c.verdicts) tally.set(v, (tally.get(v) ?? 0) + 1);
  for (const [v, n] of [...tally].sort((a, b) => b[1] - a[1]))
    console.log(`    ${String(n).padStart(3)} ${v.padEnd(17)} ${VERDICT_MEANING[v]}`);
}

if (jsonOut) {
  const json = JSON.stringify(results, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  writeFileSync(jsonOut, json + "\n");
  console.log(`\nwrote ${jsonOut}`);
}
