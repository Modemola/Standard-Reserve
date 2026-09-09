// The browser fetches attack and scenario JSON from /public, but the engine
// tests and the Sentinel CLI read the repo-root copies. Copying on predev and
// prebuild keeps the two from drifting; the copies stay committed so a build
// works even if this never runs.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "..", "..");

/** A1, A2, ... A10 — not the string order, which puts A10 first. */
function naturalById(a, b) {
  const parse = (f) => {
    const m = /^A(\d+)(.*)$/.exec(f);
    return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, f];
  };
  const [an, ar] = parse(a);
  const [bn, br] = parse(b);
  return an !== bn ? an - bn : ar.localeCompare(br);
}

function sync(name, withManifest) {
  const from = join(repoRoot, name);
  const to = join(webRoot, "public", name);
  mkdirSync(to, { recursive: true });

  const files = readdirSync(from)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort(naturalById);
  for (const f of files) copyFileSync(join(from, f), join(to, f));

  if (withManifest) {
    const ids = files.map((f) => f.replace(/\.json$/, ""));
    writeFileSync(join(to, "index.json"), JSON.stringify(ids, null, 2) + "\n", "utf8");
  }
  console.log(`synced ${files.length} ${name}`);
}

sync("scenarios", false);
sync("attacks", true);
