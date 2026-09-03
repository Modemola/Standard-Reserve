# Build checklist

Master list, ordered start to finish, per [`docs/ARCHITECTURE.md`](ARCHITECTURE.md). Tick items off in place (`[ ]` → `[x]`) as we land them — this file is the source of truth for what's left, not memory or chat history.

**Status: every item is checked off** except the §6 boundary note (not a task — a standing reminder of what stays out of scope). Phases A–E are built, tested, and verified live (screenshots, e2e, CI green on GitHub for both jobs). Nothing here means "done forever" — reopen an item (`[x]` → `[ ]`) if a regression or new requirement calls for it.

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
- [x] Optional debug "break POL" toggle (dev-only) so the Lab invariant pill can be demoed going red (§11, explicitly optional) — verified: hidden in the production build (`NODE_ENV === "production"`, 0 matches in the built app), present under `next dev` and correctly flips `invariants OK` → `invariants FAIL` on click

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
- [x] Content pass on `/` and `/law` copy — `/` already met the spec; `/law` was stale (missing the Phase E work) and thin, so `law-mapping.ts` and the page now also cover the three `LawMath.sol` functions in a second table, plus a framing paragraph explaining what the mapping is for

## 6. Blockchain — optional Solidity twins (Phase E)

Per spec §0 non-goals: **no real `$STANDARD` or charter NFTs get deployed, ever, in this project.** This phase is narrow — audit-narrative Solidity twins of the pure math, nothing else. Do not start until Phase C is playable (it is).

- [x] `contracts/law/src/LawMath.sol` — `pure` Solidity twin of `P(t)` Dutch decay (via PRBMath UD60x18 `pow`), the resolution-fee quadratic, and the contraction spend-tick formula
- [x] Foundry test harness (`contracts/law`, forge-std + PRBMath vendored, not submodules)
- [x] Shared test vectors generated from the live TS engine (`packages/engine/scripts/generate-law-vectors.ts` → `contracts/law/test/vectors/*.json`) and checked against `LawMath.sol` within a relative tolerance for `dutchPrice`/`resolutionFeeRate`, exactly for `contractionSpend` — plus 5 fuzz property tests (monotonicity, bounds, day-clamp). All 8 pass at 5000 runs each. One real bug found and fixed in the process: `dutchPrice`'s ratio could underflow UD60x18's precision and collapse to a hard 0 before `t` reached `DAY_SECONDS` for extreme `pStart`≫`pFloor` gaps — fixed by extending the engine's own "never let the ratio hit a literal zero" floor to cover fixed-point underflow, not just `pFloor==0`
- [x] Wired into CI as a separate `contracts` job (`foundry-rs/foundry-toolchain`, `forge test` + `forge fmt --check`)
- [ ] Explicitly out of scope unless requested later: wallet integration, real deployment, mint site, allowlist checker, governance, token unlocks — all non-goals per §0

## 7. Release readiness / QA

- [x] `pnpm test` green (engine)
- [x] `pnpm --filter web run build` green
- [x] Both Playwright e2e flows passing against a running server
- [x] Manual visual pass on `/`, `/lab`, `/bank/c-0042` (screenshots)
- [x] `pnpm --filter web run e2e` wired into a CI check (`.github/workflows/ci.yml`: `test` job — install → engine test → web build → Playwright install → e2e; `contracts` job — forge test + forge fmt --check; on push to `main` and on PRs). Confirmed actually green on GitHub itself for both jobs, not just locally — checked via the Actions API after each push.
- [x] Final disclaimer/footer text spot-check across all routes — lives once in `apps/web/app/layout.tsx`'s shared footer, so every route (`/`, `/lab`, `/bank/:id`, `/scenarios`, `/law`) renders it identically; text matches spec verbatim

## 8. Post-spec UX iteration

Not in the original architecture doc — found while deliberately looking for rough edges beyond the spec's minimum.

- [x] **Silent-failure bug**: `world.lastError` is set by the engine on every rejected action (daily caps, insufficient payment, unknown charter, not-yet-dormant, ...) but nothing in the UI ever read it — a rejected click just did nothing, indistinguishable from a bug. Added `components/ErrorToast.tsx`: a global toast (mounted once in the root layout, inside `SimProvider`) that shows a human-voiced message per error code and auto-dismisses after 4s, re-triggering even on back-to-back identical failures (keyed on the `World` object reference, which is fresh on every `store.apply()`, not on the error string). Covered by a permanent Playwright test, not just an ad-hoc check.
- [x] **Mislabeled swap input**: `/lab`'s buy/sell used one shared text input for both an ETH amount (buy) and an STD amount (sell) with no unit indicator — found this while adding the `aria-label` the input was missing, since any label would have been wrong for one of the two buttons. Split into two clearly-labeled inputs (`ETH to spend buying STD` / `STD to sell`, defaults `1` / `1000`) rather than papering over it with a vague shared label.
- [x] Added `aria-label`/`placeholder` to the remaining unlabelled Lab injector inputs (seed count, `charterDailyCap` override) missed in the earlier Phase D a11y pass, which had focused on badges/modals/sliders and not plain text inputs.
- [x] **Spec'd feature that was never wired up**: Phase B (§9) required a "Constants drawer" in the Lab, `ConstantsDrawer.tsx` existed and was fully built, and the README already documented "in the Lab use the constants drawer to inspect the live `params` object" as if it worked — but the component was never imported or rendered anywhere. Wired it into `/lab` as a show/hide toggle below the injectors (collapsed by default, since the full JSON dump is verbose); confirms every `unpublished_placeholder` constant is genuinely reachable in the UI, not just documented. Covered by a permanent Playwright test.
- [x] **Same pattern, second instance — `buyCharter` had zero UI path**: the engine exports `buyCharter`/`quoteCharterPrice`, `AuctionClock` already renders a "Charter clock" on `/bank/:id` right alongside the (actionable) license clock, and the Lab already has a `force charterDailyCap` injector specifically to open the charter auction for testing — but nothing anywhere ever called `buyCharter`, so opening the auction led nowhere. Added a "buy charter" injector next to `force charterDailyCap` in the Lab (charter creation is a god-mode/new-owner action, not scoped to the currently-viewed charter, so it belongs there rather than in the cockpit). Also fixed a minor consistency nit found alongside it: `buyCharter`'s insufficient-payment early return skipped the `invariantsOk` refresh every other action wrapper does (same pattern as the earlier `checkIn` fix, currently harmless since nothing `invariantCheck` inspects changes on that path, but kept consistent). Verified live (Charter clock goes from "closed, 0/0 sold" to "1/5 sold" after purchase) and covered by a permanent Playwright test.
