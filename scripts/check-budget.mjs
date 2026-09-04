#!/usr/bin/env node
// Performance budget gate.
//
// The 756KB LCP image that shipped on the landing page was found by reading
// a lint warning, not by measuring anything -- nothing in the repo would have
// stopped the next heavy asset from landing. This does.
//
// It measures only deterministic things: bytes on disk, gzipped. Timing
// metrics (LCP, TTI) swing wildly on shared CI runners and would either be
// set so loose they catch nothing or so tight they fail at random. Weight is
// the input to those metrics and it does not depend on how busy the runner
// is, so it is the honest thing to gate on.
//
//   node scripts/check-budget.mjs            # check against perf-budget.json
//   node scripts/check-budget.mjs --update   # rewrite the budget to current
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps", "web");
const NEXT = join(WEB, ".next");
const BUDGET_PATH = join(ROOT, "perf-budget.json");

if (!existsSync(NEXT)) {
  console.error("check-budget: no apps/web/.next -- run `pnpm --filter web run build` first.");
  process.exit(1);
}

/** Gzipped size of a built chunk, which is what the browser actually pulls. */
const gzipCache = new Map();
function gzipSize(rel) {
  if (gzipCache.has(rel)) return gzipCache.get(rel);
  const abs = join(NEXT, rel);
  const size = existsSync(abs) ? gzipSync(readFileSync(abs)).length : 0;
  gzipCache.set(rel, size);
  return size;
}

// First-load weight per route: the union of the chunks for the page and
// every layout above it, split into JS and CSS. Union, not sum -- shared
// chunks are downloaded once, and counting them per-segment would inflate
// every nested route.
//
// This runs deliberately higher than the "First Load JS" column in `next
// build` (~125kB vs ~88kB for /law). That column does not account for the
// root layout's own client components, and SimProvider, SiteNav, Ticker and
// ErrorToast are all client components that every single route really does
// download. Counting them is the point: a budget that ignores the shell
// would not notice the shell getting heavier.
const manifest = JSON.parse(readFileSync(join(NEXT, "app-build-manifest.json"), "utf8")).pages;
const routes = {};
for (const key of Object.keys(manifest)) {
  if (!key.endsWith("/page")) continue;
  const route = key.slice(0, -"/page".length) || "/";
  const chunks = new Set(manifest[key]);
  // Walk up the segment tree collecting each ancestor layout's chunks.
  let seg = route === "/" ? "" : route;
  for (;;) {
    for (const c of manifest[`${seg}/layout`] ?? []) chunks.add(c);
    if (!seg) break;
    seg = seg.slice(0, seg.lastIndexOf("/"));
  }
  let js = 0;
  let css = 0;
  for (const c of chunks) (c.endsWith(".css") ? (css += gzipSize(c)) : (js += gzipSize(c)));
  routes[route] = { js, css };
}

// Public assets, raw. Images and fonts are already compressed; gzipping them
// again measures nothing real, and these are served as-is.
const assets = {};
function walkPublic(dir, prefix = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) walkPublic(abs, rel);
    else if ([".png", ".jpg", ".jpeg", ".webp", ".avif", ".woff", ".woff2"].includes(extname(entry.name)))
      assets[rel] = statSync(abs).size;
  }
}
if (existsSync(join(WEB, "public"))) walkPublic(join(WEB, "public"));

const current = { routes, assets };
const kb = (n) => `${(n / 1024).toFixed(1)}kB`;

if (process.argv.includes("--update")) {
  // Headroom so ordinary edits don't churn the budget file; the point is to
  // catch a step change, not to pin every byte.
  const pad = (n) => Math.ceil((n * 1.1) / 1024) * 1024;
  const budget = {
    _comment:
      "Gzipped first-load JS and CSS per route, and raw public asset sizes, in bytes. Runs higher than `next build`'s First Load JS column on purpose -- see scripts/check-budget.mjs. Regenerate with `node scripts/check-budget.mjs --update`, and say in the commit message why the budget moved.",
    routes: Object.fromEntries(
      Object.entries(routes).map(([k, v]) => [k, { js: pad(v.js), css: pad(v.css) }]),
    ),
    assets: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, pad(v)])),
  };
  writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2) + "\n");
  console.log(`check-budget: wrote ${BUDGET_PATH}`);
  for (const [r, v] of Object.entries(routes))
    console.log(`  ${r.padEnd(14)} ${kb(v.js).padStart(8)} JS  ${kb(v.css).padStart(7)} CSS`);
  process.exit(0);
}

if (!existsSync(BUDGET_PATH)) {
  console.error("check-budget: no perf-budget.json -- create it with --update.");
  process.exit(1);
}
const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8"));

const failures = [];
const missing = [];

const over = (label, actual, limit) => {
  if (actual > limit) failures.push(`${label}: ${kb(actual)} exceeds budget ${kb(limit)} (+${kb(actual - limit)})`);
};

for (const [name, limit] of Object.entries(budget.routes ?? {})) {
  if (!(name in routes)) continue; // route deleted; not a budget failure
  over(`route ${name} JS`, routes[name].js, limit.js);
  over(`route ${name} CSS`, routes[name].css, limit.css);
}
for (const [name, limit] of Object.entries(budget.assets ?? {})) {
  if (!(name in assets)) continue;
  over(`asset ${name}`, assets[name], limit);
}
// A new route or asset with no budget line is a gap, not a pass. Silently
// ignoring it is how the 756KB image got in.
for (const name of Object.keys(routes)) if (!(name in (budget.routes ?? {}))) missing.push(`route ${name}`);
for (const name of Object.keys(assets)) if (!(name in (budget.assets ?? {}))) missing.push(`asset ${name}`);

for (const [r, v] of Object.entries(routes))
  console.log(`  ${r.padEnd(14)} ${kb(v.js).padStart(8)} JS  ${kb(v.css).padStart(7)} CSS`);
for (const [a, v] of Object.entries(assets)) console.log(`  ${a.padEnd(14)} ${kb(v).padStart(8)}`);

if (missing.length) {
  console.error(`\ncheck-budget: no budget line for:\n  ${missing.join("\n  ")}`);
  console.error("Run `node scripts/check-budget.mjs --update` and commit the result.");
}
if (failures.length) console.error(`\ncheck-budget: over budget:\n  ${failures.join("\n  ")}`);

if (failures.length || missing.length) process.exit(1);
console.log("\ncheck-budget: all routes and assets within budget.");
