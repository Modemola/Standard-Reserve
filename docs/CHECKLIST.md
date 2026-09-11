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
- [x] Vitest suite covering the §11 checklist — **67/67 passing**: the §11 example-based tests, 9 seeded property/fuzz tests over random op sequences, 9 covering the sweep instrument, and 9 covering the adversarial probes (see §8)
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
- [x] `pnpm --filter web run build` green, `pnpm --filter web run lint` green, `pnpm perf` within budget
- [x] Playwright e2e suite (**64 flows**) passing against a running server — 8 cockpit/Lab behaviours, 10 accessibility gates (per-route WCAG contrast including the populated sweep grid, keyboard focus rings, `aria-current`, reduced motion), 4 layout/palette guards, 7 scenario/sweep tests, 26 responsive gates across four device classes, and 9 control-wiring gates
- [x] Manual visual pass on `/`, `/lab`, `/bank/c-0042` (screenshots)
- [x] `pnpm --filter web run e2e` wired into a CI check (`.github/workflows/ci.yml`: `test` job — install → scenario sync check → engine test → lint → web build → perf budget → Playwright install → e2e; `contracts` job — forge test + forge fmt --check; on push to `main` and on PRs). Confirmed actually green on GitHub itself for both jobs, not just locally — checked via the Actions API after each push.
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
- [x] **Full bottom-to-top bug sweep** — drove every route and clicked every enabled button on a fresh page each time, capturing console output, checking for duplicate DOM ids, nameless buttons, missing alt text, dead links and layout overflow. Found and fixed:
  - `Sparkline` derived its SVG gradient id from stroke colour + history length, so the two ribbons on `/lab` emitted **identical DOM ids** whenever the regime was expansion (both gold, same length) — invalid HTML, one gradient shadowing the other. Now `useId()`.
  - **Horizontal overflow on mobile**: `/` overflowed by exactly 145px = `(680−390)/2`, the guilloché being wider than the viewport with nothing clipping it; `/bank/:id` by 55px from the `lg` regime badge — "CONTRACTION" set in tracked didone is wide. Both fixed (responsive sizing + `overflow-hidden`); all five routes now measure exactly 390px at 390px.
  - **Actions with no feedback**: `sell STD` and `spawn genesis charters` changed real state but nothing visible moved, because `/lab` showed only `F_n (last epoch)` (updates at epoch close) and no charter count at all — the Lab exists to inject flow and didn't show the flow being injected. Added a live `net flow (this epoch)` stat and a `N live / N total · daily cap N` readout beside the charter injectors.
  - `Commit on live sim` was clickable with every slider at rest, applying nothing. Now disabled until something is staged, with the helper text explaining why.
  - `DEMO_CHARTER_ID` existed but the nav and landing CTA hardcoded `c-0042`, so changing the demo charter would have silently broken both links. Both now derive from the constant.
  - Stale docs: this file claimed 26 engine tests and "both" e2e flows; actual counts are 28 and 8.
- [x] **Property/fuzz suite for the TS engine — two real bugs, caught on the first run.** The Solidity twin had 20,000 fuzz runs per property and that found two genuine bugs; the TS engine, which is far larger and is the thing that actually ships, had only example-based tests. Added `packages/engine/test/properties.test.ts`: 60 seeded random op-sequences × 40 ops, asserting the supply identity, `S_max` monotonicity, POL monotonicity, no negative balances anywhere, invariants staying green, constant-product monotonicity, and honest tick duration. Both failures were confirmed to fail pre-fix:
  - **The AMM's constant product `k` decreased on every swap.** `pool.ts` computed the *remaining* reserve with bigint's truncating `/`, which hands the rounding dust to the trader — so `k` eroded slightly on each trade, the one invariant an AMM actually rests on. Now uses a `ceilDiv` helper for the remaining side so rounding favours the pool and `k` is non-decreasing. Five other properties passed untouched, so this was the only such leak.
  - **`tick` silently advanced less time than asked for.** The loop is bounded by `MAX_TICK_STEPS`, so a 20-year tick advanced exactly `5000 × 86400` seconds and returned a world that had never reached the requested instant — with nothing anywhere saying so, while every downstream number described that wrong world. Kept the bound (a hostile `dt` must not hang the tab) but truncation now reports `tick_truncated`. The property asserts the real contract: advance fully, or say you didn't.
- [x] **The linter had never run — and it was hiding a crash.** `pnpm lint` was wired to `next lint` but no ESLint config and no ESLint dependency existed, so the script did nothing and CI never called it. The tree even carried an `// eslint-disable-next-line react-hooks/exhaustive-deps` comment that nothing had ever honoured. Installed `eslint` + `eslint-config-next`, added `.eslintrc.json` with `react-hooks/rules-of-hooks` as an error, and added a lint step to CI. First run found:
  - **A conditional hook in the Banker's Cockpit.** `app/bank/[id]/page.tsx` called `useMemo` *after* the not-found early return, so the hook count changed the moment a charter stopped resolving and React would tear the page down with "rendered fewer hooks than expected" instead of showing the empty state. Types, build and e2e all passed straight over it. Hook moved above the return; the rule was confirmed to flag the pre-fix file.
  - **The landing page's LCP element was a 756KB raw `<img>`.** 2800×1480 PNG, no intrinsic dimensions, so it both dominated the load and shifted the page as it arrived. Now a `next/image` with a static import (real dimensions + blur placeholder), `priority`, and `sizes` capped at the container's true width. A 1080w viewport now receives **24KB of WebP** instead of 756KB of PNG.
- [x] **Missing error boundaries — one throw white-screened the app.** Every page drives the engine on the client, and there was no `error.tsx` and no `not-found.tsx`; an unexpected throw gave a blank page with a bare "Application error", and a bad URL dropped the reader out of the app shell entirely. Added both. The error boundary uses `reset()` rather than a reload, so retrying keeps the world the user has built up — the `SimStore` lives above the boundary.
- [x] **Accessibility, measured rather than eyeballed.** Wrote `tests/a11y.spec.ts`, which computes real WCAG relative-luminance ratios (compositing each text colour's own alpha over the first opaque ancestor background) across all five routes, and tabs through the Lab asserting a visible focus ring at every stop. It failed on first run in three places, all genuine:
  - **Text as low as `white/25` — 2.1:1, failing AA at every size.** The dim tiers had drifted well below legibility: `/25` and `/30` fail outright, and `/35`/`/40` only ever qualified for large text. These weren't decorative — they carried the Law table's notes column, each scenario's explanation, and the footer disclaimer. Remapped `/25→/45`, `/30→/50`, `/35→/55`, `/40→/60`; the tiers stay distinct so the visual hierarchy is unchanged, and the darkest text is now 4.5:1.
  - **No focus styles anywhere in the app.** 43 interactive elements and not one focus indicator; the Lab's inputs went further and stripped the browser's default with `focus:outline-none`, leaving a `white/8 → white/25` border tint that is invisible on this ground. Added a global `:focus-visible` gold ring (`:focus-visible`, not `:focus`, so it never fires on mouse clicks) and removed the `outline-none` — Tailwind's variant was winning the specificity fight against it.
  - **The `contraction` red itself failed AA.** `#C0392B` is 3.66:1 on ink and 3.42:1 on the card surfaces, which put the regime label, the error toast, and the sell/reset buttons under the threshold. Lifted to `#DC5546` — same brick hue, ≥4.5:1 on every surface in the palette.
  - Also regenerated the hero shot, which was a screenshot taken before both changes and so advertised a product that no longer existed.
- [x] **The nav never said where you were.** All five links rendered identically on every route — no active state visually, and no `aria-current` for assistive tech. Added both, matching on the *first path segment* rather than the whole href so `/bank/<any charter id>` still marks Bank as current. The indicator is not colour-only (WCAG 1.4.1): the desktop link gains a gold rule beneath it, the mobile item a left border. Guarded by an e2e test across all five routes plus a non-demo charter id.
- [x] **Responsive and interaction sweep — clean.** Checked all five routes at 375/768/1280px for horizontal overflow (none — every wide table already scrolls in its own container), verified all 43 interactive elements have handlers, cross-checked every internal link against the real routes, and drove the mobile nav end-to-end (it opens, navigates, and closes itself correctly). Also confirmed the Ticker renders exactly once per page after a screenshot made it look duplicated — the DOM probe disproved it rather than a guessed "fix" being applied.
- [x] **Every route shared one tab title and no link preview.** The root layout set a single `title`, so four open tabs were indistinguishable and every shared link previewed identically; there was no Open Graph or Twitter card at all, despite a perfectly good product shot sitting in `public/`. Added a title `template` plus per-route metadata — including `generateMetadata` for the cockpit, so the charter id appears in the tab title — and OG/Twitter cards with `metadataBase` set (without it the relative `og:image` never resolves for a crawler and Next warns at build). The two client-component routes get their titles from a sibling server `layout.tsx`, which is the supported way to do it. Verified each route's rendered `<title>` and that the `og:image` URL actually serves.
- [x] **Locked down quote/execute agreement.** The cockpit renders `quoteRetirement` in the exit ticket and then calls `retireBranch` on confirm — if those ever computed the fee differently, the UI would show one number while the ledger moved by another, and both halves would look internally consistent. The engine already shares the code path (`retireBranch` calls `quoteRetirement` itself), but nothing forbade that from drifting. Added a property asserting the user is minted exactly the quoted amount, the quote's own arithmetic balances, and every unit of a retired ledger lands somewhere — minted, burned, or rebated to siblings — with nothing created or evaporated. Verified non-vacuous: the run performs >100 real retirements.
- [x] **A performance budget, so the next heavy asset is blocked rather than noticed.** The 756KB LCP image was found by reading a lint warning; nothing in the repo would have stopped the next one. `scripts/check-budget.mjs` measures gzipped first-load JS and CSS per route (union of the page's chunks and every layout above it) plus raw `public/` asset sizes, and gates them against a committed `perf-budget.json`. It runs in CI after the build. Deliberately weight-only: LCP and TTI swing with runner load and would be set either too loose to catch anything or tight enough to fail at random, whereas bytes on disk are deterministic. A route or asset with *no* budget line fails too — silently ignoring new things is exactly how the 756KB image got in. Both failure modes were verified by simulating them. The figure runs higher than `next build`'s "First Load JS" column on purpose: that column ignores the root layout's own client components, and `SimProvider`, `SiteNav`, `Ticker` and `ErrorToast` are all client components every route really does download.
  - **First finding: `/lab` was 225kB, double every other route.** recharts is 102kB gzipped — 45% of the route — for four charts that sit below every interactive control. Now a `next/dynamic` import with `ssr: false` and a placeholder that reserves their exact height, so nothing shifts when they arrive. **`/lab` first-load JS: 225kB → 125kB**, in line with the rest of the app, and the controls hydrate without waiting for a charting library.
- [x] **The palette had silently forked.** Lifting `contraction` to `#DC5546` for contrast updated the Tailwind class but not the six places the hex was copy-pasted as a literal — SVG `stroke`/`fill` and recharts props can't read a Tailwind class. Three copies kept drawing the old, failing `#C0392B`: the Lab's rosette, one sparkline, and every chart. Nothing caught it because the contrast gate inspects text colours, not SVG strokes. Fixed structurally rather than by patching strings: `lib/palette.ts` is now the single source, `tailwind.config.ts` imports from it, and no literal palette hex remains anywhere in `app/` or `components/`. Verified the built bundle contains no `#C0392B` and that the charts render `#DC5546` against live scenario data.
- [x] **Expansion regime reviewed directly — it had never been looked at.** Every screenshot to date happened to be mid-contraction, so the gold treatment was verified computationally but never seen. Driving `inflow_week` and reviewing all routes found one real defect: **the Lab's four telemetry values sat on two different baselines at every width**, because "net flow (this epoch)" and "F_n (last epoch)" wrap to two lines while "signal" and "m" do not. Labels now reserve two lines whether or not they use them. A first attempt using `flex-1` on the label was *wrong* and the tests caught it — two of the four cells are `StatSpark`, which carries a sparkline after the value, so letting the label absorb the slack pushed those values up instead. Aligning the label box is what actually works.
  - The ticker's expansion text looked red in the screenshot; measuring it showed `rgb(201,162,39)` — correct. Nothing was "fixed" on the strength of a misread image.
  - Locked both in with `tests/layout.spec.ts`: per-row baseline alignment at 1024/1280/1440px, and a guard that both regimes paint their own colour in the ticker, the badge **and the charts' SVG attributes** — the exact gap that let the palette fork go unnoticed.
- [x] **Every bundled scenario is now driven through the UI.** Only `exodus` had a UI test; the other four were exercised in-process only, so a scenario could have loaded into a broken screen without any gate noticing. `tests/scenarios.spec.ts` drives all five and asserts the claim each one's own `teach` string makes, so the copy on `/scenarios` cannot drift from what the simulation does. Verified the tests *discriminate*: pointing three of them at the wrong scenario made them fail. That check found a real weakness — the wash test passed when handed `exodus`, because both end at `F_n 0, m 1`. Strengthened with the assertion that actually separates them: a wash must **not** tip the world into contraction, because volume is not direction.
- [x] **Hero asset cut 815KB → 138KB.** The source was 2800px wide while `sizes` caps display at 1024px, so everything past 2048 was detail nothing could render; re-shot at 2100px as JPEG q88 (inspected for artefacts on the mono numerals — clean). On-page delivery is unchanged at 24KB of WebP, since `next/image` was already re-encoding; the win is for social crawlers, which fetch the raw file for the OG card.
- [x] **Removed `Quote.lockedAt`, a field that documented behaviour the engine did not have.** It was written in `exits.ts` and read nowhere — not by the UI, not by any test. The name promised a time-locked quote, but `retireBranch` recomputes rather than honouring one issued earlier, so the type was making a guarantee the code never kept. No user-visible bug (the cockpit re-renders from live state, and a property test enforces that display and execution agree), but a type is a spec, and a lie in the spec is the same drift class this sweep has been chasing everywhere else. Deleted, with a comment recording *why* it is absent so it does not get reintroduced: if quotes ever need to survive a round trip, the staleness window and the honouring logic go in together — not the timestamp on its own.
- [x] **Parameter sweeps — the repo can now produce findings, not just play back one world.** `packages/engine/src/sweep.ts` runs a grid of parameter values across a fixed market and reports where the policy degenerates. Three drafts were wrong before it measured anything real, and each correction is recorded in the tests:
  - **Verdicts judged every market by one rule.** The first run reported 0% healthy across the entire grid because sustained inflow pins `m` to its ceiling — which is the policy *working*. Workloads now declare what a sound policy should do under them, and degeneracy is judged relative to that.
  - **The "directionless" workload's direction depended on the seed.** It drew buy and sell magnitudes independently in different units, so a run drifted up or down by luck; the sweep reported a ratchet that vanished on 3 seeds out of 5. It now sells back exactly what it bought, fixing direction by day parity.
  - **A cell was one run.** One seed is an anecdote. Cells now aggregate over several seeds and a verdict fires only in a majority — the result then replicated exactly (10/30) across four independent seed blocks.
  - **The detector was tuned twice before being made principled.** "Share of time at the floor" needed an arbitrary cutoff and "ended at the floor" turned on a single epoch. Replaced with `mDepth` — how far through the launch-to-floor range a run settled — which is scale-relative and uses the whole trajectory. Its threshold sits in an empty gap (healthy cells measure 0.03–0.08, failing ones 0.73–0.95) rather than slicing a cluster.
  - **The finding it produced:** under genuinely directionless churn, `m` drifts by `raiseStep - cutStep` per cycle, because `updateM` cuts on a single bad epoch but needs two conditions to raise. **Any `cutStep` above `raiseStep` walks issuance to the floor no matter how balanced the market is** — and the shipped default is `cutStep 0.25` against `raiseStep 0.05`. This is spec-conformant behaviour (cut fast, raise slow), so it is a property to be aware of rather than a bug; the sweep's job is to make the consequence visible.
- [x] **`/sweep` — the instrument is in the app, not just the CLI.** A route that runs the grid, colours each cell by verdict, and shows the selected cell's `m` trajectory, metrics and per-seed verdict rates. Runs in a **Web Worker**: a 30-cell grid is ~4,000 simulated days of the full engine, and on the main thread the tab would freeze hard enough that it could not paint its own progress bar. The e2e test asserts responsiveness and correctness together — it waits for the grid within the run, which can only succeed if the main thread stayed free, and then asserts the rendered grid **matches the CLI's output cell for cell**, which it does (10/30 healthy under `choppy`). Also carries a "reading this honestly" panel: the placeholder constants mean a sweep describes the shape of the model, not the calibration of the real protocol.
- [x] **Reduced motion was silently ignored for the spinner — a selector that looked right.** The `prefers-reduced-motion` block enumerated animated classes by name, and one entry was written `[class*="animate-[spin"]`, which matches Tailwind's *arbitrary-value* syntax (`animate-[spin_1s]`) and not the plain `animate-spin` utility the code actually uses. Measured under `reducedMotion: "reduce"`, the sweep page's loading spinner reported `animation-name: spin, duration: 1s` — running at full speed for exactly the people who had asked it not to. Enumerating is the wrong shape for this rule: it fails *open*, and fails again for every animation added later. Replaced with the blanket `*, *::before, *::after` reduced-motion reset plus explicit resting states for the three animations whose end state isn't where they should stop (`.mote`, `.draw`, `.rise`). Added an e2e gate that walks every route with the preference set and asserts nothing is still running — verified to fail against the old CSS.
- [x] **The contrast gate was blind to the sweep page's actual content.** It loaded `/sweep` empty, so the grid, the verdict list and the selected-cell panel — the majority of that page, and all of its colour-carrying UI — were never measured. An empty page passing says nothing about the page people read. The check now runs a sweep, selects a cell, and measures the populated state (0 failures, but the gap was real).
- [x] **Raised the Playwright timeout from 30s to 60s.** The dormancy test drives 31 daily ticks through the real UI at 12–18s on a developer machine — under 2× headroom against a 30s ceiling, and it duly failed once in a full-suite run while passing in isolation. There is no faster UI path (`epochSeconds` is one day), so the test is legitimately long rather than accidentally slow. A gate that flakes is worse than no gate: the habit it teaches is to re-run rather than to look.
- [x] **Verified, not assumed: the sweep worker does not leak.** Navigating away mid-run appeared to leave a worker alive. A control experiment (spawn a worker, terminate it, watch the count drop) proved the measurement sound, and the real worker does die — in 0.8–2.3s, scaling with grid size, because the browser cannot kill a worker mid-synchronous-block. `terminate()` on unmount is correct; the latency is the browser's floor. This did surface a genuine gap though — there was no way to **cancel** a running sweep at all, so a 180-day × 10-seed grid left the reader watching. Added a cancel button: the UI releases in ~100ms, and cancellation must be `terminate()` rather than a message, because `runSweep` never pumps the worker's message queue mid-run.
- [x] **External review pass — six of eight concerns valid, one invalid, and one exposed a vacuous test.**
  - **The demo world opened in contraction, and that made the Phase B exit test meaningless.** The seed traded for two epochs but the final ticks closed epochs with no flow, so the last closed epoch was `F_n = 0` — contraction by spec. Every route, every screenshot and the product shot opened red, and the gold half of the design was never seen. Worse: `lab: loading exodus flips the regime to contraction` asserted a state that was **already true**, so it would have passed if the scenario loader did nothing at all. The seed now closes its last epoch on net inflow (and leaves a little flow in the open epoch so "net flow this epoch" is not a flat zero), and the test asserts the starting state first so it cannot go vacuous again.
  - **What-if ribbon was missing two of its five spec'd entries.** [ARCHITECTURE.md §"What-if drawer sliders"](ARCHITECTURE.md) requires "m, your yield/day, S_circ, gold, feeRate"; it shipped m, S_circ, feeRate, S_max. Added *your yield/day* (this charter's share of a day's issuance, in tokens — never a rate, since §0 forbids APY in the UI) and *expansion gold*. Those two are the only entries that answer "what does this do for me", which is what separated a banker's tool from a debug panel.
  - **`/lab` rendered zero characters of server HTML.** `<Suspense fallback={null}>` meant crawlers, link previews and the first paint of a slow connection all saw an empty `<main>`. Replaced with a real server-rendered description of the instrument: 0 → 712 characters.
  - **Landing copy flattened the policy.** It said "net ETH inflow raises m". The spec is explicit that `signal_n = F_{n-1} + F_{n-2}` (two *completed* epochs) drives issuance while this epoch's sign only routes fees — so one good day does not raise m. Corrected on the page that most people read.
  - **`/bank/0042` dead-ended** while the landing CTA reads "Enter demo bank #0042". A purely lexical normalisation now 307-redirects bare numbers to the canonical `c-` form, so links, metadata and the crawler's view stay in agreement.
  - **Two honesty labels.** The pool spot of ~1e-6 ETH/STD is *arithmetically correct* (100 ETH against 100M STD) rather than broken, so it is labelled "sim units" instead of inflating `genesisEth` to make the number flattering — manufacturing a nicer price is the one thing this project must not do. And `buyLicense` burns the price into `B` exactly as the whitepaper says but debits no balance, because §0 says no wallet in v1; the slot now says "sim: burned, not debited" rather than implying a purchase that was never funded.
  - **Invalid:** "add the disclaimer to lab and cockpit" — it lives in the root layout and was already present on all five routes; verified by grepping the served HTML.
- [x] **Adversarial probes — can a rational actor extract value?** The sweep asks which parameter settings degenerate; this asks the other half of "is the policy sound". `packages/engine/src/adversary.ts` plays three strategies — pump-and-harvest, licence churn, self-reported dormancy — each against a **passive control in the same world**, because issuance streams to every live branch whether you attack or not and only the difference from doing nothing is attributable. The harness also charges the adversary for licences that the engine does not debit (v1 has no wallet per §0), or "buy a licence, retire it, keep the mint" would have reported as free money — an artifact of the simplification, not a finding.
  - **No strategy beats the control at default parameters.** Licence churn ends on a *third* of what passive holding earns, because retiring resets a branch's accrual. Self-reporting collects the bounty — capped at 100 STD — and forfeits the entire ~394,000 STD position.
  - **The interesting result is *why* the pump fails.** It does exactly what it sets out to do: `m` peaks at its ceiling (1.25) against 0.75 for the control, and it harvests 841,000 STD more issuance. But an 80 ETH round trip through a 100 ETH pool pays **47% in slippage**, which swamps the gain. **The defence is liquidity depth, not the `m` rule** — and it weakens as the pool grows: round-trip loss falls 47.1% → 12.9% → 1.6% → 0.2% as `genesisEth` goes 100 → 100,000, while the issuance edge stays flat at 841,000 STD. The cost of manufacturing the signal scales with depth; the reward does not. Whether that ever crosses into profit depends on the real pool depth and token price, neither published — so it describes the model's shape, not the protocol.
  - Two bugs in the harness itself were found by reading its own output: it forgot to credit the dormancy bounty (so "reporting yourself doesn't pay" rested on never counting the payment), and it reported `m` only at the end of the run — fifty days after the pump stopped — which hid the entire effect. Both now guarded by tests.
- [x] **Final furnish — `/scenarios` rebuilt, and it immediately caught a scenario that lied.** That page was the one surface visibly below the rest of the app: flat cards, no visual signature, and a dead zone that left the footer stranded mid-page. Rebuilt with the landing page's ghost-numeral treatment, a guilloché accent, display type, and — the substantive part — **each card now shows what the scenario actually does**, computed by replaying it on the server at build time rather than from a caption someone typed. Static page, so the client pays nothing for it, and a scenario that stops matching its own description changes the card on the next build.
  - **It caught one on the first run.** `exodus` ran for 7,200 seconds against an 86,400-second epoch, so it never closed one — yet its description promised "issuance cuts on close" and `m` sat at 1.00 throughout. The flagship contraction scenario never demonstrated the cut it exists to teach. Extended it by one day so the epoch closes: it now reports contraction, 1 epoch, **m landing at 0.75**. (`license_mania` also ends at epoch 0, but it only claims a burn, and it delivers one — left alone.)
  - The empty sixth grid cell now points at `/sweep` instead of being a hole.
- [x] **The contrast gate's decorative exemption was a hardcoded allowlist.** It skipped ghost numerals via `!/^0[1-4]$/`, which silently stopped covering anything the moment a fifth card existed. Now keyed on `aria-hidden`, which is the machine-readable marker WCAG 1.4.3's "pure decoration" exemption actually means — self-maintaining, and impossible to abuse without committing a larger bug. Switching to it exposed that the **landing page's numerals were never `aria-hidden` at all**, so a screen reader had been announcing "01" before "Adoption". Fixed.
- [x] **Device pass — the app was never actually responsive, only checked at one width.** §5 recorded a "responsive check at 1280px" and moved on. Auditing all six routes across 320/375/390/414/768/1024px plus phone-landscape found five real defects, one of them serious:
  - **`/law`'s tables were clipped, not scrollable.** Both sat in `overflow-hidden` wrappers ~80px narrower than the table, so on *every phone* the entire notes column was unreachable — no scrollbar, nothing to drag, the content simply gone. The earlier check missed it because **clipped content does not register as page overflow**, which was the only thing that check measured.
  - **The hamburger was the smallest control on the site** at 20×20 — under the 24px WCAG 2.5.8 floor and less than half the 44px iOS target, on the one control a phone user cannot do without. Now 44×44 via negative-margin padding, so nothing moved visually.
  - **The what-if sliders were a 6px-tall strip** — fine for a cursor, impossible for a thumb. New `.range-touch` keeps the hairline track but gives a 44px hit area and a real 20px thumb.
  - **The Lab's telemetry card broke below `sm`.** A fixed ~140px epoch ring in a non-wrapping flex row left ~210px for everything else: the regime badge was shoved against the edge, "18h remaining" was clipped mid-word, and "net flow (this epoch)" wrapped to three lines. Now stacks below `sm`.
  - **`/lab` pushed the page sideways at 320px.** The injector buttons' labels were set up to truncate but the buttons lacked `min-w-0`, so a flex item refused to shrink past its content and never gave truncation the chance.
  - Plus four sub-24px links, and a **ticker that cut off mid-word at "S_CI"** with nothing to say more existed — S_circ, F_n, spot and the invariant pill were invisible on every mobile page. Added an edge fade as the affordance (pointer-events-none, hidden once it fits).
- [x] **`tests/responsive.spec.ts` — 26 gates across four device classes.** Tests *three* failure modes rather than one: the page scrolling sideways, content clipped by an ancestor that cannot scroll, and controls too small to hit. The middle one is the class that the old single-width check was structurally blind to.
- [x] **Every control on every route is verified wired (`tests/wiring.spec.ts`, 9 gates).** This closes the one bug class nothing else here could catch: a button whose handler was never attached, or was attached to a no-op, renders perfectly and passes types, build, lint and every flow-specific e2e test that does not happen to press it. The gate clicks *every* button, link, slider and select on all six routes and asserts the page observably responds — URL, visible text, or an aria state. **Result: all 36 controls respond; nothing is dead.**
  - The audit's own first draft reported three working sliders as dead, because it set `input.value` directly — React installs its own value setter, so a direct assignment updates the DOM without ever reaching `onChange`. Real event simulation shows they work. Written up in the spec so the next person does not repeat it.
  - Four controls legitimately change nothing *on the page*: the whitepaper link (new tab), the default market button (already selected), `force charterDailyCap` with its unchanged default of 0, and `export world JSON` (fires a download). Each is asserted **separately** rather than skipped — the cap button is proven to move `params` 0→7 and unlock the charter auction, and the export is proven to produce `world-epoch-N.txt` — so "inert" cannot quietly become "broken".
  - The scenario `<select>` is asserted on its own value rather than the page text, because choosing a scenario only stages it; `load scenario` applies it.
- [x] **A mark, and the favicon the app never had.** The tab icon was blank on every route — the one piece of branding a reader sees before anything loads. `components/Logo.tsx` draws an engraved seal: a guilloché rosette ring around a didone **S**, generated by the same hypotrochoid maths as the background rosettes, so the mark and the product are cut from one plate. Placed in the nav, on `/404`, on the error boundary, and as `app/icon.svg` + `apple-icon.svg` (generated from the same geometry so the favicon cannot fork from the mark).
  - **The first draft was a dollar sign.** It struck a vertical rule through the S, on the reasoning that currency symbols are built by striking a letter ($ ¢ ₦ ₮ ₽ ₿). Rendered, it was a gold coin with a `$` on it — borrowing the dollar's glyph for a protocol issuing its own currency, and the most worn cliché in the category. Removed; the engraving carries the mark instead.
  - **The ring was solved, not eyeballed.** A hypotrochoid spans |(R−r)−d| to (R−r)+d with R/gcd(R,r) lobes, so R−r=36, d=9 pins it to the annulus 27–45 — exactly the gap between the letter's clear space and the rim. The decisive constraint is **d < r**: above it the curve throws crossing loops and the ring reads as a thorn tangle, which is what the first parameter set (d=9, r=5) actually looked like. `rosette(46, 10, 9)` gives 23 even lobes whose cusps break the outer rule the way reeding breaks a coin edge. An earlier draft layered two rosettes *and* 60 milling ticks; three competing textures in a 20px band read as a scribble.
  - Degrades deliberately: below 32px the engraving is dropped, since it collapses to a smudge, and the seal keeps its rules and its letter down to 16px. The `S` is set in the app's display face with a system-serif fallback rather than drawn as a path — a logo that needs a webfont to have arrived is a logo that is sometimes missing.
  - Caught in passing: `/404` claimed "the four routes below" while listing five, and **omitted `/sweep` entirely**.
- [x] **Deeper sweep — structural and validation layers** (things the browser sweep could not reach):
  - **Split-brain scenario files.** `scenarios/` (repo root) and `apps/web/public/scenarios/` were duplicated with nothing keeping them in step, and they have *different consumers*: the engine test suite replays the root copy, the app fetches the public one. A scenario could therefore pass its tests and ship broken, or ship fine and never be tested. Root is now canonical, `scripts/sync-scenarios.mjs` regenerates the public copy on `prebuild`/`predev`, and CI runs it with `--check` so drift fails the build. Verified by deliberately drifting a file and watching the guard catch it.
  - **Params accepted every nonsensical config.** The schema type-checked fields individually but had no cross-field rules, and README tells users to hand-edit `default.json`. `mMin > mMax` silently pins `m` via `updateM`'s clamps; `feeFloor > feeCeil` collapses `feeRateFromP` to the *lower* bound and makes `LawMath.sol` underflow on `feeCeil - feeFloor`; `genesisEth = 0` opens the pool with no ETH so `k = 0` and the AMM is broken from genesis. Added `superRefine` checks with actionable messages, plus 7 tests. Deliberately still allows `baseDailyStd = 0` — zeroing issuance to isolate fee dynamics is a legitimate experiment in a simulator, and validation should not over-reach.
  - **A typo'd scenario op was skipped in silence.** `loadScenario`'s switch had no `default`, and nothing downstream noticed: invariants still held and the replay still hashed deterministically, so the bundled-scenario tests would happily pass a scenario that taught nothing. Unknown ops now surface as `scenario_unknown_op`, and a test asserts every op in every bundled scenario against the exported `SCENARIO_OPS`.
  - **`Failed to find font override values for font 'Bodoni Moda'`** on every build — Bodoni is absent from Next's font-metrics table, so no `size-adjust` was applied to the fallback and the webfont swap shifted layout. Named the fallback explicitly and opted out of the automatic adjustment; the build is now warning-free.
- [x] **`loadScenario` leaked a scripted rejection as a user-facing error** — found by the sweep: loading `ghost_purge` raised a red "hasn't been idle long enough" toast, reading as though the load had failed. It hadn't: that scenario checks a charter in precisely so its later dormancy report *must* be rejected — that is the lesson. But a scripted replay is not something the user just did, so the last action's `lastError` must not survive the load. Same root shape as the earlier stale-`lastError` bug, different entry point. Covered by an engine test confirmed to fail pre-fix.
- [x] **`fetchScenario` in `lib/scenarios.ts` was built with correct error handling (`res.ok` check, descriptive throw) and never used** — the Lab's own `loadScenarioById` reimplemented a worse version inline (`fetch(...).json()`, no `.ok` check, no try/catch at either of its two call sites: the URL-param effect and the dropdown button), so a failed or aborted fetch — bad network, a bad `?scenario=` query param slipping past the allowlist check, a deploy asset mismatch — did nothing visible at all. Fixed by actually calling `fetchScenario` and routing failures through the same `lastError` → `ErrorToast` path every other rejected action uses (a new app-level, non-engine error code, `scenario_load_failed`, added to the toast's message dictionary with a note explaining it isn't from the engine). Verified live with Playwright route interception forcing the fetch to fail; covered by a permanent test using the same technique.

## 9. Phase 2 — Hook Sentinel + Open Market Desk

Per [`docs/ARCHITECTURE-SENTINEL-DESK.md`](ARCHITECTURE-SENTINEL-DESK.md). Same engine, same `World`, same `SimStore` — no second AMM, no second `m` rule, no copied `World` type.

### 9.0 Spec gaps closed before starting

The Phase 2 spec assumed three things the repo did not yet have. Each was resolved in the smallest way that fits what was already here, rather than by bending the engine around the new packages.

- [x] **Per-tick buyback visibility.** A4/A12 assert that *every hourly* contraction buyback stays inside `min(10% vault, 0.2% pool)`, but a single `tick(86400)` replays 24 buyback hours internally, so the per-hour figures were invisible from outside. `tick(world, dt, trace?)` now threads an optional `EngineTrace` down to `runContractionBuyback`, recording `{t, vaultBefore, poolEthBefore, spend, burned}` per hour. Deliberately *not* World state, so `hashWorld` and every previously recorded hash are unchanged — verified by the existing scenario-hash tests still passing untouched. This is the hook §14.3 anticipated, and it avoids the alternative that section forbids (faking a vault inside the Desk).
- [x] **`params.floorEpsilon`.** The Desk's "floor" plan row needs a tolerance for how close to `P_floor` counts as *at* the floor. Added as a **relative** tolerance (`0.01`), so it holds at any price scale, and tagged in `meta.sourceNotes` as an implementation default exactly like `licenseMinFloorStd` — it prices a display row, not policy.
- [x] **`/bank/0042` → `/bank/c-0042`.** Added as a declarative `next.config.mjs` redirect. **Caught a real bug in my own first attempt**: the pattern landed as a single-backslash escape, which JavaScript silently collapses to a literal `d` — the route was `(d+)` and would never have matched a digit, failing in exactly the way the redirect was meant to prevent. Found on a byte-level check of the written file rather than by eye, then verified behaviourally (`307 → /bank/c-0042 →` cockpit renders), not just by reading the config back.
- [x] **The open design question — how the tape gets written.** §9 says "every existing mutation appends a tape row", but `SimStore.apply` takes a bare `(world) => world` and has no idea what it just ran. Resolved as `apply(fn, op?)` where the row's *numbers* are derived by diffing the World before and after and only the label comes from the caller — so an unlabelled or mislabelled call site still records correct figures. `TapeRow` lives in `packages/engine`, since both `SimStore` and `packages/desk` consume it and the engine is the only package both can depend on.

- [x] **Reconciled with what `main` already knew.** The Phase 2 work was branched from `e889c38` while `main` moved ten commits ahead, so merging was not just textual. Three things had to be settled rather than merged: `@standard-law/engine` already exported a `runAttack` (a profitability probe), so Sentinel's became `runFixture`/`runFixtureWorld` — one name for two meanings in one monorepo is a trap. `main`'s WCAG gate measures every route, and the new UI leaned on `text-white/30..45`, which is 2.51–4.18:1 on the card surface, all under AA; 32 instances were lifted to `white/55` (5.67:1) and `/sentinel` and `/desk` were added to the gate's route list rather than left exempt by omission. And `main`'s adversary probe concludes "the pump works" while Sentinel's A2 returns HELD — see §9.5.

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
- [x] Fixture sync folded into main's `scripts/sync-scenarios.mjs` rather than shipping a second script beside it. Main's already had a `--check` drift mode mine lacked, so it absorbed `attacks/` (plus the `index.json` manifest the browser needs, since it cannot list a directory) and `apps/web/scripts/sync-fixtures.mjs` was deleted. Drift detection verified by tampering with a public copy and watching `--check` exit 1, not by assuming it works.
- [x] 8 new Playwright flows (**88 total** once the new routes joined the device and wiring gates, no regressions against the rest of the suite): the catalogue really runs and shows `0 broken`; a CHEAP note renders and does not read as broken; Replay in Lab loads the after-world; the flip number measures ≥44px at 1280px ("cannot be missed" held to something checkable); three priced plans; the tombstone renders with no price element present; a Desk commit prints to the shared tape; the crowd slider moves the quoted rate while leaving the live one alone
- [x] `PLAYWRIGHT_BASE_URL` support so e2e can reuse an already-running app instead of spawning its own
- [x] **Held to every gate the rest of the app meets, not just the ones I remembered.** Adding the new routes to the a11y gate found the contrast problem, which raised the obvious question of what else they were exempt from — and `responsive.spec.ts` and `wiring.spec.ts` both listed six routes and neither of mine. Adding them found two real defects. `/desk` failed on all four device sizes: the exit sliders were 16px against the 24px WCAG 2.5.8 floor, fixed with main's existing `.range-touch` rather than a second fix of my own. And `/sentinel`'s "Run all"/"Run this" changed nothing observable — attacks are deterministic, so a re-run produces identical verdicts and the button read as broken; each run now records `run #N: 14 in 412ms`. The two genuinely inert controls (a file download; the row already selected on first paint) are declared in `INERT` with their own assertions, per that file's rule that inert must never quietly become broken.
- [x] **One flake chased to its actual cause.** The full suite began failing intermittently. My first diagnosis was wrong — I read the line reporter's last *progress* line as the failing test and hardened a toast assertion that was not the problem (kept anyway: it did race a 4s auto-dismiss, and a negative control proves it fails when the text never renders). The real failure was `layout.spec`'s regime-colour poll timing out at 5s. Confirmed contention rather than breakage before changing anything: the engine still replays `exodus` to contraction, and the test passes 6/6 in isolation while failing in full runs. The suite now mounts `/sentinel` — 14 attacks on arrival — roughly ten times across the device and wiring gates, which is real CPU competing in parallel workers. Given 20s of headroom with the reasoning recorded, matching the call `main` made for `ghost_purge`'s loader.

### 9.4 Wiring and docs

- [x] Root `pnpm test` now covers engine + sentinel + desk (**130 tests**: 73 engine, 39 sentinel, 18 desk); e2e **91**; `pnpm sentinel:run` added
- [x] CI: unit suites step broadened, plus a dedicated Sentinel step that gates the merge on broken invariants and never on yellow findings
- [x] `docs/ARCHITECTURE-SENTINEL-DESK.md`, `docs/LAW.md` Phase 2 tables, README Phase 2 section + 20-second demo script
- [ ] **CI confirmed green on GitHub for the Phase 2 commits.** Still blocked, and still not on anything technical: PR #1 was merged and closed at `e889c38`, and the workflow only fires on `push` to `main` or on `pull_request`, so none of the Phase 2 commits has had a CI run. Needs a PR opened against `main`. Per this repo's own standard that is not the same as green locally, and §6 records a bug that only a CI run caught — so the pipeline was instead walked step by step against the workflow file, which turned up two steps that had never been exercised at all:

  - **`pnpm install --frozen-lockfile`.** Locally this had only ever been run as a plain `pnpm install`, which would have papered over a lockfile drifted from the four `package.json` files this phase added or changed. It passes, so the lockfile is genuinely in sync.
  - **The e2e step's `webServer` path.** Every local run set `PLAYWRIGHT_BASE_URL` and reused an already-running app, so the branch of `playwright.config.ts` that CI actually takes — the one this phase introduced — was untested by the very change that introduced it. Now run end to end that way: **91/91**.
  - **The whole `contracts` job**, which cannot run here because Foundry is not installed, verified indirectly instead. Nothing under `contracts/` has changed since the last green run at `e889c38`, so `forge fmt --check` is untouched; and regenerating the shared vectors from the current engine produces output **byte-identical** to what is committed, so `forge test` sees exactly the vectors it already passed against. The trace parameter and the `quoteLicense` change touch none of `dutchPrice`, `feeRateFromP` or `contractionSpend`.
  - Unit suites (**119**), `pnpm sentinel:run` (exit 0), fixture-sync `--check`, lint, build and `pnpm perf` — all green, in the workflow's own order.

  None of this substitutes for a real run, and the item stays open. It does mean that if the pipeline fails, it should fail on something this could not simulate rather than on something nobody looked at.

### 9.4a Rough edges found by auditing my own Phase 2 work

Same discipline as §8: look for something built that nothing reads, or referenced that does not exist. Two in my own work.

- [x] **`?sentinel=` was a decorative URL.** `/sentinel` applied the attack's after-world to the store itself and *then* pushed `/lab?sentinel=<id>`; the Lab only read `?scenario=`. Sharing or reloading that link gave you the demo world under a URL still naming an attack — the URL lied, and only because the in-memory store happened to carry the state across a client-side navigation. The Lab now loads the attack from the URL (single source of truth, Sentinel just navigates) and shows a banner naming the world you are looking at. Two tests: the link survives a reload, and an unknown id errors rather than failing silently. That error path needed a toast message — `ErrorToast` had no entry for `attack_load_failed`, so it would have been silent, the same bug class already fixed twice in §8. Found by checking, not by it firing.
- [x] **`quoteLicense().yourRemainingToday` was the constant `3`.** It returned `maxLicensesPerCharterPerDay` regardless of what the charter had bought, so the field never said anything true. Nothing caught it because the cockpit — the only caller that needs the number — derived its own inline, correctly, and never read the field: exactly the shape of `e889c38` and `def5ccf`. `quoteLicense` now takes the charter, `licensesRemainingToday` is exported for it, and the cockpit reads the quote instead of restating the rule. Five tests, four of which fail against the old constant (verified by reverting it, not assumed).
- [x] Removing the store write from Sentinel left dead state behind it — an unused store handle, a toast nothing could set, an unused import. Deleted rather than left to rot.

### 9.4b Sentinel's own expectation schema, audited

Turned the same question on the schema: is any of this configuration doing nothing? Two fields were used by no fixture, dead in different ways.

- [x] **`mMayChange` had zero references in the runner.** Copied from the spec's §4.1 interface sketch and never implemented, so a fixture could set it and be asserted nothing — silently. Worse than a missing field, because it reads like a check; it is the same trap the shadow-world machinery was removed for, shipped by me. Removed rather than implemented: "m may change" is a permission, and a permission has nothing to verify.
- [x] **`ledgerUnchangedFor` was implemented but unusable.** It compared the ledger across the whole run, and any tick accrues issuance, so it could never hold for a fixture that advances time — which is exactly why nothing used it. Re-scoped to the final action as `ledgerUnchangedByLastAction`, which is what the claims that need it were actually saying. That made it real, and two fixtures turned out to be asserting this in prose without testing it: **A7**, whose entire question is "where does the licence payment come from?", checked that something burned but never that no ledger was debited to pay for it; and **A11**, whose teach text ends "no ledger change", never checked that a refused report leaves its target alone. Both now do, both still HELD, and the check is proven non-vacuous by a rigged fixture whose last action is a tick — the ledger must move across it, and the check must go broken.
- [x] Covered the `pending` path that spec §6 requires for fixtures listed but not yet built, and which no shipped fixture exercises: it grades nothing and gates CI neither way.

### 9.4c What looking at the pages found

Every gate was green, so the next audit had to come from outside them: open the two new surfaces next to a redesigned one and compare. They were written before `main`'s design pass and still drew the old flat panels — **zero** uses of `Card` and **zero** serif headings across all eight components — so they read as a different app once seen side by side. Two of the differences were defects rather than taste, and no gate could have caught either, because contrast passed, nothing overflowed and every control responded.

- [x] **The licence table's columns had collided.** Cells had no horizontal padding at all, so the header read `burn status` as one word and the body rendered `3498.84open`. Fixed with real cell padding.
- [x] **The charter tombstone was a tall empty box.** `h-full` inside a stretch grid blew it down the entire column. The columns were also badly unbalanced — the left ended near the fold while the right ran on past it — because it had been built as two columns of two and three, when spec §8.3 describes an actual 2×2. It is now that 2×2, with `items-start` so each cell is its own height.
- [x] Both pages brought onto `Card`, the serif display face and `main`'s section-label treatment, so they belong to the same app as `/lab` and `/law`.

### 9.4d The wiring audit's failure was a real bug, not a flake

- [x] `/sentinel` failed the wiring audit, and re-running made it pass — which is exactly the habit `main`'s own Playwright config warns about, so it got chased instead. **The audit reloads before every control**, so `/sentinel` re-ran all fourteen attacks fifteen-plus times per run, which is what blew its 180s budget under load. The underlying fault was mine: spec §8.2 asks for an auto-run on the **first** visit, and it re-ran on every mount *and* every reload, though verdicts are deterministic and byte-identical each time.
- [x] Verdicts are now cached for the session, keyed off the fixtures themselves so editing an attack invalidates them rather than serving a stale verdict. A return visit is instant. Only a *full* run is cached — caching a single "Run this" would serve a partial catalogue as though it were complete. Full e2e went from **14.1 minutes with three timeout failures to 6.1 minutes with none**.
- [x] One of the two new cache tests then failed in the full suite while passing alone, and that was the test's fault, not the page's: the auto-run is deliberately suppressed once a run exceeds 2s (§8.2, "otherwise require one click"), which under load it does — so the page was correctly cache-missing *and* correctly not re-running. The test was measuring two features at once; it now clears that flag so the cache key is what is actually under test.

### 9.4e The pages I had not audited

The previous visual pass only ever looked at my own two surfaces. Applying the same lens to the six that predate them found three defects, none of which any gate could catch.

- [x] **The cockpit quoted a price for a market that does not exist.** The charter clock rendered its decaying quote with a small "closed" pill beside it — `0.2279 ETH, 0 of 0 sold` — while the policy cap was zero and nothing could be bought. WP §8 and the Desk's own charter board both require a closed market to show no tradable price, and the Desk already honoured it, so the two surfaces disagreed about the same fact. A closed clock now reads **unopened** and quotes nothing.
- [x] **The same clock quoted tokens to four decimals.** Design language §3 is four for ETH, two for tokens; it used four for both, so the licence clock reported STD to four places while the branch rack beside it reported the same price to two.
- [x] **`wash_same_epoch` did the opposite of what it taught.** Its sell was a hand-estimated round number that pulled 0.99385 ETH back against 1 ETH in, so F_n closed at **+0.0061**: the epoch tipped *expansion* and m was never cut. The `/scenarios` card read "ends in expansion, m lands at 1.00" directly beneath a description promising contraction-side routing — on a page built to stop exactly that drift. The sell is now solved against the engine's own `sellStd`, so ETH out equals ETH in to the wei, F_n lands on zero, and the epoch closes contraction with m cut to 0.75.
- [x] That last fix **overturns a deliberate, commented assertion** in `scenarios.spec.ts`, which required the wash to end in *expansion* on the argument that "round-tripping the same ETH must not tip the world into contraction". `ARCHITECTURE.md` disagrees twice: line 120 defines regime as `F_n > 0 ? expansion : contraction // zero = contraction`, and line 504 specifies this very scenario as "equal buy+sell, `F_n=0` → contraction fees". A perfect wash lands exactly on that threshold. The old assertion was right about the file as it stood and wrong about what the file was for. Its real job — discriminating wash from exodus, which also closes contraction with m cut — is now done by supply, measured rather than assumed: a wash mints nothing and only burns, ending **below** the genesis float at `S_circ 99,996,128`; exodus retires a branch, minting 165 STD to the leaver and ending **above** it at `100,000,163`.
- [x] **`expansionGold` is presented but unwired**, which is A14's CHEAP finding showing up in the UI. Nothing in the engine ever writes it — WP §4.3 makes the conversion optional and v1 does not implement it — yet the Lab devoted a whole chart panel and a stat to it, both permanently zero and both reading like an accumulating reserve. Now labelled as unwired, with the chart saying plainly why it is flat. Not implemented instead, because choosing to convert is policy, and inventing policy is out of scope.

### 9.4f A test of mine that passed for the wrong reason

- [x] The cache-invalidation test waited for A1's verdict pill before reloading. A1 is the *first* attack computed and lands about thirty milliseconds in, while the other thirteen are still running — and the cache is only written once a run completes. So the test reloaded with nothing cached, the reload re-ran from scratch, A1 came back broken, and it passed without the cache key ever being consulted. It passed just as happily with the key replaced by a constant, which is how it was caught. It now waits for the run to finish, and was verified in both directions: red against the constant key, green against the real one. Two earlier attempts to fix it by raising the timeout were wrong and are recorded here as wrong — the symptom was never slowness.

### 9.5 The two pump findings, reconciled

- [x] `main`'s adversarial probe (`packages/engine/src/adversary.ts`, `pnpm attack`) reports that **the pump works** — a sustained pump drives `m` to its ceiling and harvests ~841,000 STD more issuance than a passive control, and what stops it paying is roughly 47% round-trip slippage through a 100 ETH pool, a defence that decays as the pool deepens. Sentinel's `A2_one_block_pump` returns **HELD**. Both are correct, and a reader meeting them cold would reasonably conclude the repo argues with itself, which is worse than either finding being wrong. A2's teach text now states that it is the *single-epoch* case; A3 is named as the mechanism a sustained pump actually exploits; and both point at `pnpm attack`. Sentinel answers "is the rule enforced"; the probes answer "is enforcing it enough". The honest summary, now written down in `docs/ARCHITECTURE-SENTINEL-DESK.md`, is that the multiplier rule is enforced exactly as written and that being enforced is not the same as being sufficient.

### 9.6 Optional Phase E+ — deliberately not taken

- [x] Assessed and declined, with a reason rather than silence. The gate ("only after Sentinel A1/A2/A4/A12 are green") is now open, but nothing in Phase 2 warrants a Solidity twin: `flipQuote` is a sign test and a one-wei increment, `exitImpact` reuses the resolution-fee quadratic that `LawMath.sol` already twins, and `secondsUntilFloor` is a **display** helper — twinning it would add ceremony without adding audit value. Reopen this if a Phase 2 formula ever becomes policy rather than presentation.

### 9.7 The two CHEAP findings, measured instead of described

Both surviving yellow verdicts were written as impressions — "the regime
flickers around zero", "a raise is a sign test, not a size test" — which is
enough to notice a property and not enough to decide anything about it. Each
now carries a number that came out of the engine, with a test that produced it.

- [x] **A5 was underselling itself while overstating its symptom.** Only the
  sign at the epoch *close* routes anything, so flicker between swaps inside an
  epoch is cosmetic, and the fixture was demonstrating the harmless half.
  Measured on two runs identical but for a single wei: at `F_n = 0`, 70% of the
  epoch's fee income goes to the **contraction** vault and `m` is cut to 0.75;
  at `F_n = +1 wei` it goes to the **expansion** vault and `m` holds at 1.00.
  One wei at the bell decides both, and whoever moves last places it.
  `test/A5.test.ts` runs both sides of the threshold and asserts the vaults
  invert, the multiplier diverges, and only the zero-flow epoch burns through
  its buyback.
- [x] **A3's discount is six wei.** If only the sign matters, the sharp question
  is the minimum, and the minimum is one wei per epoch: `fee = (1 * 30)/10000`
  rounds to zero, so a one-wei buy closes its epoch at `F_n = +1` and earns a
  full raise. Six of them walk `m` from 1.00 to its 1.25 ceiling.
  `test/A3.test.ts` walks it: 6 epochs, 6 wei, every closed epoch exactly `1n`,
  `M` and `B` untouched, the ceiling held while the wei keeps coming and given
  back in full after one quiet epoch.
- [x] **That refines §9.5 rather than contradicting it.** The probes price a
  pump as an 80 ETH round trip and conclude ~47% slippage is the defence — true
  of the strategy they measure, but a strategy that moves no size has nothing to
  slip, and nothing is round-tripped in the dust walk. The defence that does
  apply is the asymmetry: a 0.05 raise against an immediate 0.25 cut makes the
  ceiling expensive to **hold** rather than expensive to **reach**. Written into
  the reconciliation section, along with the caveat that v1 models no chain
  (§0), so six wei prices the rule and not the transaction.
- [x] **No policy proposed, deliberately.** Whether a strict sign test wants a
  deadband, or a raise wants a size floor, is a decision for the whitepaper's
  authors; inventing either here would be inventing tokenomics, which §0 rules
  out. What this changes is that the decision is now a concrete one — with a
  number attached — rather than an impression.

### 9.8 A14's note had nothing holding it up

A14 is the third CHEAP finding, and unlike the other two it is a claim about
what the engine does *not* do: a ten-fold move in `ethPerGoldGram` changes
nothing, because the expansion vault holds ETH and never converts. That kind of
claim is true until somebody makes it false, and nothing here would have
noticed the day it happened.

- [x] **`vaultGoldMustNotDecrease` could not fail.** `expansionGold` is a
  constant zero — nothing in the engine writes it — so a check that gold has
  not fallen holds for every possible run. It is the same class as §9.4b's
  `mMayChange`: a field that reads like a check and asserts nothing. Replaced
  with `vaultGoldUnchanged`, which is what A14's note actually claims, and
  which goes red the moment anything writes the field. Both fixtures that used
  it (A14, A4) now carry the stronger form.
- [x] **`test/A14.test.ts` asserts the negative directly**: the fixture's own
  action sequence run under both parameter sets, with the resulting worlds
  required to be identical to the byte. Its job is to fail one day.
- [x] **Both proven against a rigged engine, not assumed.** A four-line patch
  making an expansion close convert to gold turns the test red and makes the
  fixture report `gold moved 0 -> 31500000000000000`. Before the change the
  same rig left A14 reporting "no effect on any balance" while gold was
  visibly moving — the note was false and the suite was silent. The rig was
  reverted and the file confirmed byte-identical to `HEAD`.
- [x] **One wrinkle worth writing down**, because it cost a wrong first
  attempt: `hashWorld` deliberately hashes params alongside state, so *any*
  overlay changes the hash whether or not a balance moved, and the first
  version of this test failed for that reason alone. That was the test being
  wrong, not the engine. The params are now substituted back before comparing,
  leaving every state field still hashed, and a positive control on
  `poolFeeBps` — a parameter that is consumed — proves the comparison still
  detects a real divergence.
- [x] The verdict stays **CHEAP** rather than becoming BROKEN, which is right:
  a wired conversion is not an invariant violation, it is a stale note. CI is
  gated by the vitest test; the fixture's yellow line now reports what moved
  instead of reciting prose.

### 9.9 The pre-ship sweep, and the one thing it found

Everything else in this file is about whether the simulator is honest. This is
the one item that was about whether it is safe to serve, and it came from
auditing dependencies rather than code.

- [x] **Next 14.2.35 carried two critical advisories, and there was no patched
  14.x.** Unauthenticated RCE in the Image Optimization API when AVIF is used,
  and unauthenticated RCE on Windows-hosted servers, both fixed only in
  `>=15.5.24`. `14.2.35` is the last 14.2.x ever published and the `next-14`
  dist-tag points at it, so no patch-level escape existed — the only
  remediation was the major upgrade. It mattered here because the README
  deploys this from `main` to a public Vercel URL, and the landing page really
  does serve AVIF through `next/image`.
- [x] Each advisory was checked against this app's actual surface rather than
  taken from the list: no middleware, no Server Actions, no route handlers, no
  i18n, no custom server, no `remotePatterns`, and the one redirect has a
  static destination — so the middleware, Server Action and rewrite-SSRF
  entries never applied. The image and App Router / RSC ones did.
- [x] **Upgraded to `next@15.5.25` + React 19.3**, plus `recharts@2.15.4` for
  React 19 (staying on 2.x rather than taking 3.x's API break). Two files
  needed the async-params migration: the cockpit page unwraps route params
  with `use()`, and `bank/[id]/layout.tsx` awaits them in both
  `generateMetadata` and the layout itself.
- [x] **The dev-only advisories were cleared too**, though none of them ship:
  vitest 2 → `4.1.11`, which needed vite `^7.3.6` declared explicitly because
  pnpm kept re-resolving the stale peer from the lockfile, and a
  `pnpm.overrides` entry for `postcss` because `next` pins `8.4.31` exactly.
  `pnpm audit` now reports **no known vulnerabilities**, down from 35 (3
  critical, 12 high).
- [x] **The perf budget was regenerated, not silenced.** React 19 + Next 15
  cost about **+10kB** of first-load JS per route, which still passed but left
  `/desk` roughly 3.8kB of headroom where it had 12.5kB — the next ordinary
  edit would have tripped CI on a baseline shift rather than a regression. The
  script's own `--update` path exists for this, and asks for the reason in the
  commit message.
- [x] Verified rather than assumed: 130 unit tests, **91/91 e2e**, lint, build,
  `sentinel:run`, sync `--check`, `pnpm install --frozen-lockfile`, and the law
  vectors regenerating byte-identical. Plus a runtime pass over all eight
  routes against a production build, which reported **zero console errors and
  zero warnings** — the check that matters most on a React major, since that is
  where a deprecation would surface.
- [ ] **`next lint` is deprecated and goes away in Next 16.** Left alone
  deliberately: it works on 15.5, and the codemod rewrites the ESLint config,
  which is where `react-hooks/rules-of-hooks` lives — the rule §9.4's CI notes
  credit with catching a conditional `useMemo` that every other gate passed
  over. Migrating it the day before shipping risks silently dropping that. It
  is the first thing to do when Next 16 is on the table.

## 10. Phase 3 — making it legible to people who are not us

User testing returned a blunt verdict: the build was too complex to understand
or even look at. That is a real finding and not a styling complaint. Every
surface was written by people who already knew what `F_n`, `m`, POL, a Dutch
auction and a CHEAP verdict were, and none of it said.

- [x] **A plain-language glossary** (`apps/web/lib/explain.ts`), roughly fifty
  entries covering every term and every consequential action. House rules are
  at the top of the file so later entries stay consistent: `plain` answers
  "what is this?" in one sentence a stranger could read aloud; `more` is how it
  works or what the button will do; `note` is only for the thing people get
  wrong. No entry explains a term using another term that is itself in the
  glossary — if that feels impossible, the sentence is still too technical.
- [x] **`components/Explain.tsx`**, the panel that surfaces them. Settles in
  on the same easing as the rest of the app's motion, exits faster than it
  enters (a dismissal that takes as long as an arrival reads as lag), grows
  from the mark you pressed, and draws a gold hairline across its head — the
  same gesture as the plate borders elsewhere.
- [x] **Two trigger shapes, for a real reason.** The ringed mark goes beside
  headings and buttons. In the stat grids the label *itself* becomes the
  trigger with a dotted rule under it, because those grids are four columns on
  desktop and two on a phone, and a 24px mark beside an 11px label pushed them
  into worse wrapping than they already had. The term variant costs no layout
  at all.
- [x] **On a phone it is a bottom sheet with a scrim**, not a floating panel.
  A 320px screen cannot hold a popover beside its anchor without overflowing
  the page, which the responsive gate treats as a defect, or being squeezed
  into uselessness.
- [x] Keyboard and assistive behaviour: `aria-expanded` on the trigger, Escape
  closes and returns focus, one panel open at a time, and `role="dialog"`
  *without* `aria-modal` — the sheet does not trap focus, so claiming it would
  be a lie to a screen reader.

### 10.1 Three defects found by looking at it, not by running the gates

Every gate was green while all three were live, which is the same lesson as
§9.4c: contrast passed, nothing overflowed, every control responded.

- [x] **Explanations rendered in block capitals.** Triggers sit inside
  uppercase, letter-spaced labels, and `text-transform` inherits — so plain
  English came out in caps, which is harder to read than the jargon it was
  there to explain.
- [x] **Then the opposite, on the same property.** Form controls carry their
  own `text-transform` in the UA sheet rather than inheriting, so a label that
  had been uppercase silently stopped being uppercase the moment it became a
  trigger, while the labels beside it kept theirs.
- [x] **Explanations rendered in bold on the Desk**, whose card headings are
  `font-semibold`. Same bug class, third property. The panel now resets case,
  tracking, family *and* weight explicitly, and the reason is written above the
  code so the next person adds the fourth reset rather than rediscovering it.
- [x] All three are pinned by tests in `tests/explain.spec.ts`, and all three
  were **proven non-vacuous by rigging the fix back out** and watching them go
  red, not by assuming.

### 10.2 What it cost, honestly

- [x] **The wiring audit got slower, because it should.** The explainers are
  real controls, and that audit reloads the page before every single one, so
  `/lab` went from 26s to 53s and the full suite from 6.1 to ~6.6 minutes.
  Nothing was exempted from the gate to buy the time back.
- [x] **`layout.spec.ts`'s regime poll was re-budgeted from 20s to 30s.** It
  timed out in one full run and passed in the next while passing in 9.8s alone
  — the contention it was budgeted against in §9.4d has moved, because this
  work moved it. This is the case that comment already describes, not the
  §9.4f case where raising a timeout was twice the wrong answer for a test
  that was failing for an entirely different reason.
- [x] Perf budget unchanged and still passing: the glossary is prose, which
  compresses well.
- [x] 130 unit tests, **100/100 e2e** (91 before, 9 new), lint, build,
  `sentinel:run`, sync `--check` and perf all green.

