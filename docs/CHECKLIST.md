# Build checklist

Master list, ordered start to finish, per [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) and, from §9 on, [`docs/ARCHITECTURE-SENTINEL-DESK.md`](ARCHITECTURE-SENTINEL-DESK.md). Tick items off in place (`[ ]` → `[x]`) as we land them — this file is the source of truth for what's left, not memory or chat history.

**Status: every item is checked off** except the §6 boundary note (not a task — a standing reminder of what stays out of scope) and the CI confirmation in §9.4, which is blocked on a PR existing for the Phase 2 branch. Phases A–E and Phase 2 (Sentinel + Desk) are built, tested, and verified live (screenshots, e2e; CI green on GitHub for Phases A–E). Nothing here means "done forever" — reopen an item (`[x]` → `[ ]`) if a regression or new requirement calls for it.

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
- [x] Vitest suite covering the §11 checklist — **27/27 passing**
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
- [x] Shared test vectors generated from the live TS engine (`packages/engine/scripts/generate-law-vectors.ts` → `contracts/law/test/vectors/*.json`) and checked against `LawMath.sol` within a relative tolerance for `dutchPrice`/`resolutionFeeRate`, exactly for `contractionSpend` — plus 6 fuzz property tests (monotonicity, bounds, day-clamp, floor/start range). All 9 pass at 20,000 runs each. Two real bugs found and fixed by the fuzz suite (neither caught by the vectors):
  - `dutchPrice`'s ratio could underflow UD60x18's precision and collapse to a hard 0 before `t` reached `DAY_SECONDS` for extreme `pStart`≫`pFloor` gaps — fixed by extending the engine's own "never let the ratio hit a literal zero" floor to cover fixed-point underflow, not just `pFloor==0`.
  - **Caught live by CI itself**, not local testing: a random fuzz seed on GitHub's runner hit a case (`pStart`≈1e30, `pFloor`≈7.3e13, `t`=86399/86400) where `pow()`'s ln/exp precision loss caused the price to undershoot *below pFloor itself* — a different failure mode than the first bug, at extreme dynamic range rather than a hard underflow. Fixed by clamping the result to `[pFloor, pStart]` directly, since that range is true by construction regardless of the underlying power function's precision — closes the whole class rather than patching one instance. Added `testFuzz_dutchPrice_neverLeavesFloorStartRange` to guard it permanently.
- [x] Wired into CI as a separate `contracts` job (`foundry-rs/foundry-toolchain`, `forge test` + `forge fmt --check`) — this is exactly what caught the second bug above; local runs at up to 20,000 fuzz iterations never hit it, a CI run at the default 256 did
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
- [x] **Third instance — `reportDormant` was only ever exercised by one fixed scenario script**, never a live control, despite the Lab's stated purpose being to let auditors interactively exercise mechanics (§1: "god mode ... see invariants"). Weaker case than the two above (no orphaned UI or doc promise pointed at it), but dormancy is inherently a third-party action against *another* charter, not the cockpit's own, so it belongs in the Lab like `buyCharter`. Added charter-id + reporter-key inputs and a button, defaulting to `c-0042` for immediate testability.
- [x] **Real bug found while writing the test for the item above**: `world.lastError` is never cleared by `tick`, `closeEpochIfDue`, `seedGenesis`, or `checkIn` — all of which always succeed and never set it themselves. Since `ErrorToast` re-triggers on any `World` reference change (not just when the error text changes), a rejection's message would silently reappear on the *next unrelated successful action* (confirmed live: reject `report dormant`, wait for the toast to auto-dismiss, click `+1h` — the stale "not yet dormant" message pops back up as if `+1h` itself had failed). Fixed by explicitly clearing `lastError` in all four functions, matching how every rejectable action already manages it on its own success path. Covered by both an engine-level Vitest test (`packages/engine/test/store.test.ts`, confirmed to fail pre-fix) and a live Playwright check.
- [x] **`fetchScenario` in `lib/scenarios.ts` was built with correct error handling (`res.ok` check, descriptive throw) and never used** — the Lab's own `loadScenarioById` reimplemented a worse version inline (`fetch(...).json()`, no `.ok` check, no try/catch at either of its two call sites: the URL-param effect and the dropdown button), so a failed or aborted fetch — bad network, a bad `?scenario=` query param slipping past the allowlist check, a deploy asset mismatch — did nothing visible at all. Fixed by actually calling `fetchScenario` and routing failures through the same `lastError` → `ErrorToast` path every other rejected action uses (a new app-level, non-engine error code, `scenario_load_failed`, added to the toast's message dictionary with a note explaining it isn't from the engine). Verified live with Playwright route interception forcing the fetch to fail; covered by a permanent test using the same technique.

## 9. Phase 2 — Hook Sentinel + Open Market Desk

Per [`docs/ARCHITECTURE-SENTINEL-DESK.md`](ARCHITECTURE-SENTINEL-DESK.md). Same engine, same `World`, same `SimStore` — no second AMM, no second `m` rule, no copied `World` type.

### 9.0 Spec gaps closed before starting

The Phase 2 spec assumed three things the repo did not yet have. Each was resolved in the smallest way that fits what was already here, rather than by bending the engine around the new packages.

- [x] **Per-tick buyback visibility.** A4/A12 assert that *every hourly* contraction buyback stays inside `min(10% vault, 0.2% pool)`, but a single `tick(86400)` replays 24 buyback hours internally, so the per-hour figures were invisible from outside. `tick(world, dt, trace?)` now threads an optional `EngineTrace` down to `runContractionBuyback`, recording `{t, vaultBefore, poolEthBefore, spend, burned}` per hour. Deliberately *not* World state, so `hashWorld` and every previously recorded hash are unchanged — verified by the existing scenario-hash tests still passing untouched. This is the hook §14.3 anticipated, and it avoids the alternative that section forbids (faking a vault inside the Desk).
- [x] **`params.floorEpsilon`.** The Desk's "floor" plan row needs a tolerance for how close to `P_floor` counts as *at* the floor. Added as a **relative** tolerance (`0.01`), so it holds at any price scale, and tagged in `meta.sourceNotes` as an implementation default exactly like `licenseMinFloorStd` — it prices a display row, not policy.
- [x] **`/bank/0042` → `/bank/c-0042`.** Added as a declarative `next.config.mjs` redirect. **Caught a real bug in my own first attempt**: the pattern landed as a single-backslash escape, which JavaScript silently collapses to a literal `d` — the route was `(d+)` and would never have matched a digit, failing in exactly the way the redirect was meant to prevent. Found on a byte-level check of the written file rather than by eye, then verified behaviourally (`307 → /bank/c-0042 →` cockpit renders), not just by reading the config back.
- [x] **The open design question — how the tape gets written.** §9 says "every existing mutation appends a tape row", but `SimStore.apply` takes a bare `(world) => world` and has no idea what it just ran. Resolved as `apply(fn, op?)` where the row's *numbers* are derived by diffing the World before and after and only the label comes from the caller — so an unlabelled or mislabelled call site still records correct figures. `TapeRow` lives in `packages/engine`, since both `SimStore` and `packages/desk` consume it and the engine is the only package both can depend on.

### 9.1 Sentinel (`packages/sentinel`, zero React)

- [x] Fixture/verdict schema with zod (`schema.ts`), shared by the CLI and the browser so the UI cannot run a fixture the CLI would reject
- [x] `runAttack` — replays a fixture through exported engine functions only; never reimplements pool, fee or auction math. Where it needs an exact swap size it **binary-searches the engine's own `sellStd`** rather than deriving one.
- [x] An engine throw is recorded as `broken` with its message, never swallowed into a pass
- [x] `runAll` / `reportMarkdown` / `reportConsole` + `pnpm sentinel:run` → `artifacts/sentinel-report.md` (gitignored)
- [x] All 14 fixtures written (`A1`..`A14`) — **11 HELD, 3 CHEAP, 0 BROKEN**
- [x] Attack ids sort naturally (A1, A2, … A10, A14). A plain string sort put A10 *before* A1, which made the verdict table read like it was missing rows.
- [x] **Vacuity guards, added after nearly shipping a test that proved nothing.** All four P0 fixtures went green on the very first run, so each was checked for whether it actually exercised its claim. A4's "every buyback hour respects the cap" is trivially true when *no* hour runs — so `minBuybackTicks` was added and set to 24, and the fixture still holds. (The check also turned up that A1 runs 24 buyback hours of its own, and that a first draft of a standalone A4 probe ran zero because its sell was too small to force contraction — the probe was wrong, not the engine.) `sMaxMustDecrease` plays the same role for burns, since `S_max = HARD_CAP - B` only falls when something really burned.
- [x] Vitest for the four P0 attacks, plus `S2.test.ts` pinning the claims the JSON can only assert coarsely — A9's rebate landing exactly on the stayers, A13 genuinely reaching `ISSUANCE_BUDGET` rather than passing under it
- [x] **Negative controls** (`runner.test.ts`): rigged fixtures prove the harness reports `broken` on a missed expectation, a violated buyback bound, and a vacuous bound; that an incentive miss degrades to `cheap` rather than `broken`; and that `shouldFail` still fails CI when an incentive fixture breaks a real invariant. A verdict table nobody has seen go red is not evidence of anything.
- [x] CI gate proven end-to-end, not just as a unit: a rigged copy of the catalogue in a scratch directory drives the CLI to `BROKEN` → exit 1, while the shipped catalogue exits 0

### 9.2 Desk (`packages/desk`, zero React)

- [x] `flipQuote` — ETH to change the sign of `F_n`; zero net is already contraction, so flipping to expansion costs one wei more than closing the gap
- [x] `licensePlans` — three rows (now / wait / floor), each simulated on a clone. **Legality comes from the engine's own `buyLicense`**, so the Desk can never drift from the rule the Cockpit enforces, and a sold-out day reports the engine's reason instead of interpolating a fill that could not happen.
- [x] `exitImpact` + `feeRateWithCrowd` — the run tax now and with a crowded door, quoted on a clone
- [x] `charterBoard` — a closed book returns **no price field at all**, so the UI cannot render a tradable quote by accident
- [x] `poolTape` / `poolPrints` over the shared Store ring buffer
- [x] 18 unit tests covering the three exit criteria the spec names (cap 0 ⇒ closed; sold out ⇒ floor plan unavailable; `F_n > 0` ⇒ `ethToFlipToExpansion = 0`), plus clone isolation: every Desk quote leaves the live world byte-identical, engine actions share no nested references with their input, and a what-if clone can be mutated as deeply as you like without touching live state
- [x] **Removed a tautological assertion before it shipped** — a draft test asserted that burn plus rebate equalled an algebraically identical restatement of itself, which is true by construction and tests nothing. Replaced with the real invariant: `burn + rebate` equals the fee, and `mintToUser + fee` equals the ledger.

### 9.3 Frontend

- [x] `/sentinel` — attack list with verdict pills, before/after snapshot grid, tape table, broken/unexpected lists, yellow note for CHEAP, Run all / Run this / Replay in Lab / Download verdict.json
- [x] Attacks run one per frame so a long suite cannot freeze the tab; auto-runs on arrival and stops auto-running if a full run is ever measured slower than 2s
- [x] `/desk` — 2×2: flip widget, shared pool tape with a labelled `SIM` commit ticket, licence solver, exit tape with ledger/crowd sliders, charter tombstone
- [x] Nav, landing CTAs, `/law` rows for both the attack catalogue and the Desk quotes
- [x] `scripts/sync-fixtures.mjs` on `predev`/`prebuild` keeps `/public` in step with the repo-root `attacks/` and `scenarios/` — this also closes the pre-existing drift hazard where `public/scenarios` were hand-copied duplicates
- [x] 8 new Playwright flows (16 total, no Phase 1 regressions): the catalogue really runs and shows `0 broken`; a CHEAP note renders and does not read as broken; Replay in Lab loads the after-world; the flip number measures ≥44px at 1280px ("cannot be missed" held to something checkable); three priced plans; the tombstone renders with no price element present; a Desk commit prints to the shared tape; the crowd slider moves the quoted rate while leaving the live one alone
- [x] `PLAYWRIGHT_BASE_URL` support so e2e can reuse an already-running app instead of spawning its own

### 9.4 Wiring and docs

- [x] Root `pnpm test` now covers engine + sentinel + desk (**70 tests**); `pnpm sentinel:run` added
- [x] CI: unit suites step broadened, plus a dedicated Sentinel step that gates the merge on broken invariants and never on yellow findings
- [x] `docs/ARCHITECTURE-SENTINEL-DESK.md`, `docs/LAW.md` Phase 2 tables, README Phase 2 section + 20-second demo script
- [ ] **CI confirmed green on GitHub for the Phase 2 commit.** Not yet possible: PR #1 was merged and closed at `e889c38`, and the workflow only triggers on `push` to `main` or on `pull_request` — so the Phase 2 commit on this branch has had no CI run at all. Every CI step has been run locally in the exact order the workflow runs them (both root scripts included, and the sentinel gate proven to exit 1 on a break), but per this repo's own standard that is not the same as green on GitHub. Needs a PR opened against `main` for this branch.

### 9.5 Optional Phase E+ — deliberately not taken

- [x] Assessed and declined, with a reason rather than silence. The gate ("only after Sentinel A1/A2/A4/A12 are green") is now open, but nothing in Phase 2 warrants a Solidity twin: `flipQuote` is a sign test and a one-wei increment, `exitImpact` reuses the resolution-fee quadratic that `LawMath.sol` already twins, and `secondsUntilFloor` is a **display** helper — twinning it would add ceremony without adding audit value. Reopen this if a Phase 2 formula ever becomes policy rather than presentation.
