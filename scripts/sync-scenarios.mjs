#!/usr/bin/env node
/**
 * scenarios/ and attacks/ (repo root) are canonical. The copies under
 * apps/web/public/ are what Next.js actually serves over HTTP.
 *
 * These had drifted apart into a split brain: packages/engine's test suite
 * replays the root copy, while the app fetches the public copy, so a
 * scenario could pass its tests and ship broken — or ship fine and never be
 * tested — with nothing to notice. Attacks arrived with exactly the same
 * shape (Sentinel's CLI reads attacks/, /sentinel fetches the public copy),
 * so they are mirrored by this same script rather than a second one.
 *
 * attacks/ also gets an index.json manifest, because the browser cannot list
 * a directory and hardcoding the catalogue in the UI would be a third place
 * for it to drift.
 *
 *   node scripts/sync-scenarios.mjs          copy root -> public
 *   node scripts/sync-scenarios.mjs --check  exit 1 if they differ (CI)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

/** A1, A2, ... A10 — not the string order, which sorts A10 before A1. */
function naturalById(a, b) {
  const parse = (f) => {
    const m = /^A(\d+)(.*)$/.exec(f);
    return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, f];
  };
  const [an, ar] = parse(a);
  const [bn, br] = parse(b);
  return an !== bn ? an - bn : ar.localeCompare(br);
}

const drifted = [];
const counts = [];

function sync(name, { manifest = false } = {}) {
  const src = join(root, name);
  const dest = join(root, "apps", "web", "public", name);

  if (!existsSync(src)) {
    console.warn(`sync-scenarios: no source at ${src}; skipping.`);
    return;
  }
  mkdirSync(dest, { recursive: true });

  const files = readdirSync(src)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort(naturalById);

  for (const file of files) {
    const from = readFileSync(join(src, file), "utf8");
    const toPath = join(dest, file);
    const to = existsSync(toPath) ? readFileSync(toPath, "utf8") : null;
    if (from === to) continue;

    if (check) {
      drifted.push(to === null ? `${name}/${file} (missing from public/)` : `${name}/${file} (contents differ)`);
    } else {
      writeFileSync(toPath, from);
      console.log(`sync-scenarios: wrote ${name}/${file}`);
    }
  }

  if (manifest) {
    const want =
      JSON.stringify(
        files.map((f) => f.replace(/\.json$/, "")),
        null,
        2,
      ) + "\n";
    const manifestPath = join(dest, "index.json");
    const have = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;
    if (want !== have) {
      if (check) drifted.push(`${name}/index.json (manifest out of date)`);
      else {
        writeFileSync(manifestPath, want);
        console.log(`sync-scenarios: wrote ${name}/index.json`);
      }
    }
  }

  // A file served but no longer canonical is drift too.
  const orphans = readdirSync(dest)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .filter((f) => !files.includes(f));
  for (const orphan of orphans) drifted.push(`${name}/${orphan} (in public/ but not in ${name}/)`);

  counts.push(`${files.length} ${name}`);
}

sync("scenarios");
sync("attacks", { manifest: true });

if (check && drifted.length > 0) {
  console.error("sync-scenarios: the canonical directories and apps/web/public/ have drifted:");
  for (const d of drifted) console.error(`  - ${d}`);
  console.error("Run `node scripts/sync-scenarios.mjs` to resync.");
  process.exit(1);
}

console.log(`sync-scenarios: ${counts.join(", ")} ${check ? "in sync" : "synced"}.`);
