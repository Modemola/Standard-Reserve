#!/usr/bin/env node
/**
 * scenarios/ (repo root) is canonical. apps/web/public/scenarios/ is the
 * copy Next.js actually serves over HTTP.
 *
 * These had drifted apart into a split brain: packages/engine's test suite
 * replays the root copy, while the app fetches the public copy, so a
 * scenario could pass its tests and ship broken — or ship fine and never be
 * tested — with nothing to notice.
 *
 *   node scripts/sync-scenarios.mjs          copy root -> public
 *   node scripts/sync-scenarios.mjs --check  exit 1 if they differ (CI)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "scenarios");
const dest = join(root, "apps", "web", "public", "scenarios");
const check = process.argv.includes("--check");

if (!existsSync(src)) {
  console.warn(`sync-scenarios: no source at ${src}; nothing to do.`);
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const files = readdirSync(src).filter((f) => f.endsWith(".json"));
const drifted = [];

for (const file of files) {
  const from = readFileSync(join(src, file), "utf8");
  const toPath = join(dest, file);
  const to = existsSync(toPath) ? readFileSync(toPath, "utf8") : null;

  if (from === to) continue;

  if (check) {
    drifted.push(to === null ? `${file} (missing from public/)` : `${file} (contents differ)`);
  } else {
    writeFileSync(toPath, from);
    console.log(`sync-scenarios: wrote ${file}`);
  }
}

// A scenario served but no longer canonical is drift too.
const orphans = readdirSync(dest)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !files.includes(f));
for (const orphan of orphans) drifted.push(`${orphan} (in public/ but not in scenarios/)`);

if (check && drifted.length > 0) {
  console.error("sync-scenarios: scenarios/ and apps/web/public/scenarios/ have drifted:");
  for (const d of drifted) console.error(`  - ${d}`);
  console.error("Run `node scripts/sync-scenarios.mjs` to resync.");
  process.exit(1);
}

console.log(
  check
    ? `sync-scenarios: ${files.length} scenario(s) in sync.`
    : `sync-scenarios: ${files.length} scenario(s) synced.`,
);
