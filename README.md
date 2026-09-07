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
apps/web/         Next.js app — /, /lab, /bank/:id, /sweep, /scenarios, /law
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
  `sweep.test.ts` and `adversary.test.ts` guard the two instruments — that
  they measure what they claim to, not merely that they run.
  `properties.test.ts` adds a seeded fuzz layer over random op sequences,
  asserting the invariants that must hold on *every* path: the supply
  identity, `S_max` and POL monotonicity, no negative balances, a
  non-decreasing constant product, honest tick durations, and agreement
  between a retirement quote and what retirement actually charges.
- `pnpm --filter web run lint` — ESLint, with `react-hooks/rules-of-hooks` as
  an error. Not optional: it is the only gate that catches a conditional
  hook, which types, build and e2e all pass straight over.
- `pnpm --filter web run build` — typechecks and builds the app.
- `pnpm perf` — performance budget (`scripts/check-budget.mjs`): gzipped
  first-load JS/CSS per route and raw `public/` asset sizes, checked against
  `perf-budget.json`. Weight only, deliberately — timing metrics swing with
  CI runner load. Regenerate with `pnpm perf:update` after an intentional
  change, and say in the commit message why the budget moved.
- `pnpm --filter web run e2e` — Playwright, 64 flows. `cockpit.spec.ts` drives
  the real interactions (flip the regime, buy a license, retire a branch and
  watch `S_max` fall, prove the what-if drawer never touches live state).
  `scenarios.spec.ts` runs all five bundled scenarios through the UI and
  asserts the lesson each one claims to teach. `a11y.spec.ts` measures rather
  than assumes: real WCAG contrast ratios on every route, a visible focus ring
  at every keyboard stop, exactly one `aria-current` link per route.
  `layout.spec.ts` guards stat baseline alignment and that both regimes paint
  their own colour — including in the charts' SVG attributes, which is where
  the palette silently forked once. `responsive.spec.ts` checks every route at
  320/390/768px and phone-landscape for three separate failure modes: the page
  scrolling sideways, content clipped by an ancestor that cannot scroll, and
  touch targets under the 24px WCAG minimum. The middle one matters — a
  single-width check is structurally blind to it, which is how /law shipped
  with its notes column unreachable on every phone. `wiring.spec.ts` clicks
  every control on every route and asserts the page observably responds —
  the gate for a handler that was never attached, which renders perfectly and
  passes every other check.
- `cd contracts/law && forge test` — the Solidity twins, fuzzed against
  vectors generated from the live TS engine.

## Adversarial probes

The sweep asks which parameter settings degenerate. This asks the other half of
"is the policy sound": holding the parameters at their defaults, is there a
*strategy* that profits at the protocol's expense?

```
pnpm --filter @standard-law/engine run attack           # all strategies
pnpm --filter @standard-law/engine run attack --days 120
```

Every strategy is measured against a passive control in the same world, because
issuance streams to every live branch whether you attack or not — only the
difference from doing nothing is attributable. The harness also charges the
adversary for licences, which the engine does not: v1 has no wallet (spec §0),
so an uncorrected run would report "buy a licence, retire it, keep the mint" as
free money when that is an artifact of the simplification.

At default parameters none of the three strategies beats the control. The
interesting part is *why* the pump fails: it does what it sets out to do —
`m` peaks at its ceiling versus 0.75 for the control — but an 80 ETH round trip
through a 100 ETH pool pays 47% in slippage, which swamps the issuance it
unlocks. That defence is liquidity depth, not the `m` rule, and it weakens as
the pool grows:

| `genesisEth` | round-trip loss | issuance edge |
|---|---|---|
| 100 | 47.1% | 841,000 STD |
| 1,000 | 12.9% | 841,000 STD |
| 10,000 | 1.6% | 841,000 STD |
| 100,000 | 0.2% | 841,000 STD |

The cost of manufacturing the signal falls with depth; the reward does not.
Whether that ever crosses into profit depends on the real pool depth and the
real token price, neither of which is published — so this is a statement about
the shape of the model, not a claim about the protocol.

## Parameter sweeps

Live at [`/sweep`](https://standard-law.vercel.app/sweep) — pick a market, run
the grid, click a cell to see its run. It executes in a Web Worker: a 30-cell
grid is roughly four thousand simulated days, which on the main thread would
freeze the tab hard enough that it could not paint its own progress bar. The
page and the CLI call the same engine module and produce identical grids (an
e2e test asserts exactly that).

```
pnpm --filter @standard-law/engine run sweep            # all three workloads
pnpm --filter @standard-law/engine run sweep --workload choppy --days 90
pnpm --filter @standard-law/engine run sweep --json out.json
```

The Lab drives one world down one path, which shows what the policy *did* but
never whether it is sound. A sweep runs a grid of parameter values across a
fixed market and reports where the policy degenerates — issuance stuck at its
floor, the 900M budget gone inside the horizon, liquidity never forming.

Two rules make the output mean something. Every cell runs the **identical**
workload, so a difference between cells is the parameter rather than noise.
And every cell runs several **seeds**, so a verdict means the configuration
fails reliably — a single-seed version of this reported a finding that
vanished on three seeds out of five.

Degeneracy is judged relative to the market, not absolutely: `m` riding its
ceiling under sustained inflow is the policy working, and the same reading
under an outflow is the failure `cut_never_bit`.

**A caveat that bears on any conclusion drawn here:** several constants are
still `unpublished_placeholder`. A sweep tells you about the *shape* of the
model. It cannot tell you the real protocol is well calibrated.

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
