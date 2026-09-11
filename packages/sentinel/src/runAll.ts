// Load every fixture in /attacks and run it. Node-only (uses fs); the browser
// fetches fixtures itself and calls runFixture directly.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFixture } from "./runFixture.js";
import { compareAttackIds } from "./order.js";
import { parseFixture } from "./schema.js";
import type { AttackFixture, Verdict } from "./schema.js";

/** Repo-root /attacks, resolved from this file rather than the cwd. */
export function attacksDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "attacks");
}

export function loadFixtures(dir = attacksDir()): AttackFixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseFixture(JSON.parse(readFileSync(join(dir, f), "utf8"))))
    .sort((a, b) => compareAttackIds(a.id, b.id));
}

export function runAll(dir = attacksDir()): Verdict[] {
  return loadFixtures(dir).map(runFixture);
}
