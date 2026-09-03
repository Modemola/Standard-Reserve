# The Standard Reserve — Policy Twin + Banker's Cockpit

A deterministic monetary-physics engine for The Standard Reserve, with a
god-mode Lab and a single-charter Banker's Cockpit built on the same
simulated state. Simulation-first, local-first, no wallet required for v1.

Full spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Engine ↔ whitepaper mapping: [`docs/LAW.md`](docs/LAW.md) (also live at `/law`).

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
apps/web/          Next.js app — /, /lab, /bank/:id, /scenarios, /law
packages/engine/    Pure TypeScript monetary engine (bigint, 1e18 fixed-point)
packages/params/    Zod-validated params schema + default.json
scenarios/          Bundled JSON worlds (inflow_week, exodus, wash_same_epoch,
                     license_mania, ghost_purge)
docs/                Architecture spec + engine/whitepaper mapping
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

- `pnpm test` — engine unit tests (supply identities, wash-trade neutrality,
  branch/license caps, retirement, dormancy, POL monotonicity, issuance
  budget cap; see `packages/engine/test/`).
- `pnpm --filter web run build` — typechecks and builds the app.
- `pnpm --filter web run e2e` — Playwright: load a scenario in the Lab and
  watch the regime flip; open `/bank/c-0042`, buy a license, retire a
  branch, and confirm `S_max` falls (`apps/web/tests/cockpit.spec.ts`).
