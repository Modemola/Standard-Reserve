# The Standard Reserve — Policy Twin + Banker's Cockpit

A deterministic monetary-physics engine for The Standard Reserve, with a
god-mode Lab and a single-charter Banker's Cockpit built on the same
simulated state. Simulation-first, local-first, no wallet required for v1.

Full spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Phase 2 (Sentinel + Desk): [`docs/ARCHITECTURE-SENTINEL-DESK.md`](docs/ARCHITECTURE-SENTINEL-DESK.md).
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
apps/web/           Next.js app — /, /lab, /bank/:id, /sentinel, /desk,
                     /scenarios, /law
packages/engine/    Pure TypeScript monetary engine (bigint, 1e18 fixed-point)
packages/params/    Zod-validated params schema + default.json
packages/sentinel/  Attack fixtures, runner and verdict report (zero React)
packages/desk/      Pure quote/solver functions for the Desk (zero React)
scenarios/          Bundled JSON worlds (inflow_week, exodus, wash_same_epoch,
                     license_mania, ghost_purge)
attacks/            14 attack fixtures, A1..A14
docs/               Architecture specs + engine/whitepaper mapping
```

## Setup

```
pnpm i
pnpm test                    # engine + sentinel + desk unit suites
pnpm sentinel:run            # replay every attack, write artifacts/sentinel-report.md
pnpm --filter web dev        # http://localhost:3000
```

`pnpm sentinel:run` exits non-zero if any invariant attack comes back BROKEN.
Yellow (CHEAP) findings never fail CI — they are incentive observations, not
bugs.

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
manual setup. `/bank/0042` redirects to the canonical `/bank/c-0042`.

## Phase 2 — Sentinel and the Desk

Two surfaces on the same engine and the same live `World`:

- **`/sentinel`** replays 14 hostile fixtures against the engine and grades
  each one HELD, CHEAP or BROKEN. Any attack can be loaded straight into the
  Lab with "Replay in Lab".
- **`/desk`** prices the only legal moves the bank has: the ETH it takes to
  flip this epoch's sign, three priced licence plans (now / wait / floor), and
  the run tax for leaving — with a slider for what happens if the door crowds.

Current state: **11 HELD, 3 CHEAP, 0 BROKEN**. The yellows are findings worth
reading, not bugs — see the Phase 2 architecture doc for what each one means.

### 20-second Phase 2 demo

```
pnpm test
pnpm sentinel:run            # A1 HELD, A2 HELD, A4 HELD, A12 HELD, A3 CHEAP
pnpm --filter web dev

open /sentinel  → it runs on arrival → select A2 → see F_n spike but m unmoved
                → select A14 → read the yellow note → Replay in Lab
open /desk      → read the ETH-to-flip-sign number
                → licence table: now vs +2h vs floor
                → drag "others retiring this week" → the run tax climbs
                → the charter book reads UNOPENED, with no price
open /bank/0042 → redirects to /bank/c-0042 → buy or retire as the Desk suggested
```

## Changing unpublished params

The whitepaper leaves several constants unpublished. Every one of them is
declared in `packages/params/default.json` under `meta.sourceNotes` with the
value `"unpublished_placeholder"` (or an explicit implementation-default
note). To change one: edit `packages/params/default.json` directly, or in
the Lab use the constants drawer to inspect the live `params` object.
Nothing is hardcoded into JSX — every policy number flows through
`packages/params` → `World.params`.

## Testing

- `pnpm test` — unit suites across all three packages: the engine (supply
  identities, wash-trade neutrality, branch/licence caps, retirement,
  dormancy, POL monotonicity, issuance budget cap), Sentinel (the four P0
  attacks, plus negative controls proving the harness reports BROKEN when a
  fixture really does break) and the Desk quote functions.
- `pnpm --filter web run build` — typechecks and builds the app.
- `pnpm sentinel:run` — replays every attack fixture; non-zero exit on BROKEN.
- `pnpm --filter web run e2e` — Playwright: load a scenario in the Lab and
  watch the regime flip; open `/bank/c-0042`, buy a licence, retire a branch,
  and confirm `S_max` falls (`apps/web/tests/cockpit.spec.ts`); run the attack
  catalogue on `/sentinel` and read the Desk's flip, licence and exit quotes
  (`apps/web/tests/sentinel-desk.spec.ts`).

  To run e2e against an app you already have up, set `PLAYWRIGHT_BASE_URL`
  (e.g. `PLAYWRIGHT_BASE_URL=http://localhost:3000`) and Playwright will reuse
  it instead of starting its own server.
