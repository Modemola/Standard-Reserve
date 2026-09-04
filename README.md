# The Standard Reserve — Policy Twin + Banker's Cockpit

A deterministic monetary-physics engine for The Standard Reserve, with a
god-mode Lab and a single-charter Banker's Cockpit built on the same
simulated state. Simulation-first, local-first, no wallet required for v1.

Full spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Engine ↔ whitepaper mapping: [`docs/LAW.md`](docs/LAW.md) (also live at `/law`).
Build progress: [`docs/CHECKLIST.md`](docs/CHECKLIST.md).

## Official references (read-only, do not scrape at runtime)

- [Whitepaper](https://www.standardreserve.xyz/whitepaper/) — "the full design of a sovereign onchain central bank and its reflexive monetary policy"
- [App — About](https://www.standardreserve.xyz/app/about/)
- [App — Protocol](https://www.standardreserve.xyz/app/protocol/)

These pages are client-rendered and don't expose the whitepaper's numeric
constants to static fetch. Any constant not confirmed there is treated in
this repo as `unpublished_placeholder` and lives in
`packages/params/default.json`, never hardcoded into JSX.

> *STANDARD is an experimental onchain protocol. This app is unofficial. Not
> a bank. Not investment advice. Not affiliated with The Standard Reserve
> team unless they say otherwise.*

## Layout

```
apps/web/         Next.js app — /, /lab, /bank/:id, /scenarios, /law
packages/engine/  Pure TypeScript monetary engine (bigint, 1e18 fixed-point)
packages/params/  Zod-validated params schema + default.json
contracts/law/    Solidity twins of three formulas — audit narrative only,
                  never deployed; fuzzed against vectors from the TS engine
scenarios/        Canonical JSON worlds (inflow_week, exodus, wash_same_epoch,
                  license_mania, ghost_purge). scripts/sync-scenarios.mjs
                  mirrors these into apps/web/public/ and CI checks the copy
                  is in sync
scripts/          Repo tooling (scenario sync)
docs/             Architecture spec, engine/whitepaper mapping, checklist
```

## Setup

```
pnpm i
pnpm test                    # engine Vitest suite (Phase A gate)
pnpm --filter web dev        # http://localhost:3000
```

## Acceptance demo script

```
pnpm i
pnpm test
pnpm --filter web dev
open /lab → load exodus → watch contraction
open /bank/c-0042 → open what-if → raise outflows → fee ribbon up
retire a non-last branch → S_max falls
check-in → heartbeat resets
```

`c-0042` is seeded on first load with 7 live branches and accrued ledger —
see `apps/web/lib/demo-seed.ts` — so the cockpit is demoable without any
manual setup.

## Changing unpublished params

The whitepaper leaves several constants unpublished. Every one of them is
declared in `packages/params/default.json` under `meta.sourceNotes` with the
value `"unpublished_placeholder"` (or an explicit implementation-default
note). To change one: edit `packages/params/default.json` directly, or in
the Lab use the constants drawer to inspect the live `params` object.
Nothing is hardcoded into JSX — every policy number flows through
`packages/params` → `World.params`.

## Testing

- `pnpm test` — engine suite (`packages/engine/test/`). Example-based tests
  cover supply identities, wash-trade neutrality, branch/license caps,
  retirement, dormancy, POL monotonicity and the issuance budget cap.
  `properties.test.ts` adds a seeded fuzz layer over random op sequences,
  asserting the invariants that must hold on *every* path: the supply
  identity, `S_max` and POL monotonicity, no negative balances, a
  non-decreasing constant product, honest tick durations, and agreement
  between a retirement quote and what retirement actually charges.
- `pnpm --filter web run lint` — ESLint, with `react-hooks/rules-of-hooks` as
  an error. Not optional: it is the only gate that catches a conditional
  hook, which types, build and e2e all pass straight over.
- `pnpm --filter web run build` — typechecks and builds the app.
- `pnpm --filter web run e2e` — Playwright. `cockpit.spec.ts` drives the real
  flows (flip the regime from a scenario, buy a license, retire a branch and
  watch `S_max` fall, prove the what-if drawer never touches live state).
  `a11y.spec.ts` measures rather than assumes: real WCAG contrast ratios on
  every route, a visible focus ring at every keyboard stop, and exactly one
  `aria-current` link per route.
- `cd contracts/law && forge test` — the Solidity twins, fuzzed against
  vectors generated from the live TS engine.

## Deploying

The app is zero-config for Vercel — no environment variables, no database,
no server beyond what Next.js provides. `apps/web/next.config.mjs` already
declares `transpilePackages` for the two workspace packages, and the root
`package.json` pins the exact pnpm version (`packageManager`), so Vercel's
build reproduces `pnpm install && pnpm --filter web run build` exactly as
run in CI.

The one setting that isn't automatic: this is a pnpm monorepo, so when
connecting the repo at vercel.com, set **Root Directory** to `apps/web` in
the project's configure step (Vercel still runs the install from the
workspace root once it detects `pnpm-workspace.yaml` there — no extra
`vercel.json` needed). Framework Preset auto-detects as Next.js; leave the
build/install/output commands on their defaults.

Once connected, every push to `main` deploys to production and every PR
gets its own preview URL, same as the GitHub Actions CI already does.
