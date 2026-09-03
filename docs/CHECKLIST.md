# Build checklist

Master list, ordered start to finish, per [`docs/ARCHITECTURE.md`](ARCHITECTURE.md). Tick items off in place (`[ ]` → `[x]`) as we land them — this file is the source of truth for what's left, not memory or chat history.

## 0. Foundation

- [x] Architecture spec locked (`docs/ARCHITECTURE.md`)
- [x] pnpm monorepo scaffold (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`)
- [x] `packages/params` — zod-validated schema, `default.json` with every unpublished constant flagged `unpublished_placeholder`

## 1. Backend — monetary engine (Phase A, `packages/engine`)

No server/DB in this project — "backend" is the pure-TS simulation engine everything else reads from.

- [x] Types (`World`, `Branch`, `Charter`, `Auction`, `Pool`, `Vaults`)
- [x] Constant-product pool (`pool.ts`)
- [x] License + charter Dutch auctions, daily rollover (`auctions.ts`)
- [x] Streamed issuance with the 900M budget cap (`issuance.ts`)
- [x] Epoch close — F_n/signal/m update, 70/15/15 fee split, POL growth, hourly contraction buyback (`epoch.ts`)
- [x] Resolution fee + branch/charter retirement (`exits.ts`)
- [x] Dormancy check-in/report/revocation (`dormancy.ts`)
- [x] Invariant checks (`invariants.ts`) + stable world hash (`hash.ts`)
- [x] Public engine API + `SimStore` wrapper (`store.ts`)
- [x] Vitest suite covering the §11 checklist — **26/26 passing**
- [x] Spec-vs-implementation correctness audit — 6 bugs found and fixed (charter auction 3x rollover, `dormancyBountyBps` wiring, resolution-fee rebate dust loss, stale-`m` license floor pricing, `closeEpochIfDue`/`checkIn` API consistency), each with a regression test proven to fail pre-fix
- [ ] Optional debug "break POL" toggle (dev-only) so the Lab invariant pill can be demoed going red (§11, explicitly optional)

## 2. Frontend — scenarios & scaffolding

- [x] `scenarios/*.json` — all 5 required bundles (`inflow_week`, `exodus`, `wash_same_epoch`, `license_mania`, `ghost_purge`)
- [x] Next.js App Router scaffold, Tailwind, dark terminal-bank design language

## 3. Frontend — Lab / god view (Phase B, `/lab`)

- [x] World telemetry panel (epoch, regime, F_n/signal/m, supply, vaults, POL, pool spot, invariant pill)
- [x] Injectors (swap, time controls, spawn genesis, force `charterDailyCap`, scenario loader, export world JSON, reset)
- [x] Charts (net flow, m step, S_circ vs S_max, gold vault)
- [x] Verified live: loading `exodus` flips regime to contraction (Playwright + manual)

## 4. Frontend — Banker's Cockpit (Phase C, `/bank/:id`)

- [x] Demo world seed — `c-0042` with 7 live branches, accrued ledger, license day in progress
- [x] Bank health strip, branch rack, auction clocks, exit pressure
- [x] What-if drawer (clone-and-preview, does not touch live state until commit)
- [x] Retire modal + check-in
- [x] Verified live: buy license → retire branch → `S_max` falls (Playwright + manual)
- [x] "What-if does not persist until commit" — explicit Playwright test added (`bank: what-if preview does not touch live state until committed`): moving a slider changes the preview stat but leaves live `S_max` untouched; only `Commit on live sim` mutates it

## 5. Frontend — polish (Phase D)

- [x] `/` landing content
- [x] `/law` page (engine ↔ whitepaper mapping table)
- [x] README: how to change unpublished params
- [x] Responsive check at 1280px — verified via screenshot: cockpit branch rack (5 cols), right rail, and Lab telemetry/injectors/charts all render cleanly, no overflow or cramping
- [x] Screen-reader labels on badges — `RegimeBadge` (`role="status"`, `aria-label`), invariants pill (`role="status"`, `aria-live`), `ExitTicket` retire modal (`role="dialog"`, `aria-modal`, `aria-labelledby`), what-if sliders (`aria-label` per control), branch rack buy/retire buttons (descriptive `aria-label`)
- [ ] Content pass on `/` and `/law` copy (functional, not yet reviewed for polish)

## 6. Blockchain — optional Solidity twins (Phase E)

Per spec §0 non-goals: **no real `$STANDARD` or charter NFTs get deployed, ever, in this project.** This phase is narrow — audit-narrative Solidity twins of the pure math, nothing else. Do not start until Phase C is playable (it is).

- [ ] `contracts/law/LawMath.sol` — `pure` Solidity twin of `P(t)` Dutch decay, the resolution-fee quadratic, and the contraction spend-tick formula
- [ ] Foundry test harness
- [ ] Shared test vectors run against both the TS engine and `LawMath.sol`, asserting they agree
- [ ] Explicitly out of scope unless requested later: wallet integration, real deployment, mint site, allowlist checker, governance, token unlocks — all non-goals per §0

## 7. Release readiness / QA

- [x] `pnpm test` green (engine)
- [x] `pnpm --filter web run build` green
- [x] Both Playwright e2e flows passing against a running server
- [x] Manual visual pass on `/`, `/lab`, `/bank/c-0042` (screenshots)
- [x] `pnpm --filter web run e2e` wired into a CI check (`.github/workflows/ci.yml`: install → engine test → web build → Playwright install → e2e, on push to `main` and on PRs)
- [x] Final disclaimer/footer text spot-check across all routes — lives once in `apps/web/app/layout.tsx`'s shared footer, so every route (`/`, `/lab`, `/bank/:id`, `/scenarios`, `/law`) renders it identically; text matches spec verbatim
