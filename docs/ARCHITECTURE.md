# The Standard Reserve — Policy Twin + Banker's Cockpit

## Master architecture for implementation (Claude Code spec)

**Product name (working):** `standard-law`

**One sentence:** A deterministic monetary-physics engine for The Standard Reserve, with a god-mode lab and a single-charter cockpit on top of the same state.

This document is the spec. Implement against it. Do not invent tokenomics that contradict whitepaper v0.1. Where the public whitepaper leaves constants blank, put them in `params.json` and mark `source: "unpublished_placeholder"`.

**Official references (read-only context, do not scrape at runtime):**
- https://www.standardreserve.xyz/whitepaper/
- https://www.standardreserve.xyz/app/about/
- https://www.standardreserve.xyz/app/protocol/

**Disclaimer that must appear in the UI footer and README:**
> *STANDARD is an experimental onchain protocol. This app is unofficial. Not a bank. Not investment advice. Not affiliated with The Standard Reserve team unless they say otherwise.*

---

## 0. Non-goals

- Do not build a mint site, allowlist checker clone, or fake official portal.
- Do not deploy "real" $STANDARD or charter NFTs.
- Do not require a wallet for v1 (simulation-first).
- Do not hide placeholder constants. Surface them.
- Do not use the word APY in the UI.
- Do not implement governance, token unlocks, or extra markets. One pool, one currency, one signal.

---

## 1. Product surfaces

| Route | Audience | Powers |
|---|---|---|
| `/` | Anyone | Product explanation, link to Lab + demo bank |
| `/lab` | Team, auditors, you | God mode: inject flow, spawn banks, run scenarios, see invariants |
| `/bank/:id` | Banker | Legal moves only for one charter |
| `/scenarios` | Educators | List + play bundled JSON worlds |
| `/law` | Devs | Map UI/engine functions → whitepaper sections |

v1 is local-first. No auth. Charter IDs are simulation IDs.

---

## 2. Tech stack (lock this)

| Layer | Choice | Why |
|---|---|---|
| App | Next.js App Router (TypeScript, latest LTS Node) | One repo, `/lab` and `/bank` |
| UI | Tailwind + a small set of primitives (no heavy component kit required) | Fast, dark terminal-bank aesthetic |
| Charts | Recharts or visx | Multiplier ribbon, flow, supply |
| Engine | TypeScript package `packages/engine` | Same language as UI, easy test vectors |
| Tests | Vitest for engine; Playwright for two critical UI flows | Determinism first |
| Optional later | Foundry `contracts/law` with `pure` Solidity twins of fee/auction math | Audit narrative — phase 2, not blocking |

---

## 3. Design language

- Background: near-black (`#0B0D10`).
- Text: off-white. One accent for expansion (muted gold). One accent for contraction (cold red).
- Typography: one grotesque for UI, one mono for numbers.
- Regime badge is the largest object on `/bank`.
- Numbers: tabular figures, 2–4 decimals for ETH, 2 for tokens in UI, full precision in engine (`bigint` or fixed-point).
- Motion: clocks and ribbons move; no decorative particle junk.

**Copy dictionary (use only these verbs):**
- retire branch (not unstake/withdraw stake)
- buy license / buy charter
- check in
- report dormant
- epoch, signal, net flow, ledger, float, hard reserve, POL

**Repo skeleton:**
```
standard-law/
  apps/web/                 # Next.js
  packages/engine/          # pure TS monetary engine
  packages/params/          # params schema + default params.json
  scenarios/                # JSON worlds
  docs/LAW.md
  README.md
```

---

## 4. Numeric policy (engine rules)

Use `bigint` scaled by `1e18` for tokens and ETH internally. Convert at the UI edge.

### 4.1 Supply (WP §3)

```
HARD_CAP        = 1_000_000_000e18
GENESIS_POL     = 100_000_000e18
ISSUANCE_BUDGET = 900_000_000e18

S_circ = GENESIS_POL + M - B
S_max  = HARD_CAP - B
```

- `M` = cumulative withdrawal mints
- `B` = cumulative burns

Burns: 100% license payments, 100% contraction buybacks, 50% of resolution fees, 50% of dormancy revocation fees.

Team 15% is **ETH fees**, not token mint.

When cumulative issuance credits (not necessarily minted) hit `ISSUANCE_BUDGET`, base issuance stops. Ledger may still exist; fees still recycle.

### 4.2 Flow and policy (WP §4–5)

Per epoch `n`:

```
ethIn_n, ethOut_n
F_n = ethIn_n - ethOut_n
signal_n = F_{n-1} + F_{n-2}     // two completed epochs
regime_n = F_n > 0 ? expansion : contraction     // zero = contraction
```

Issuance this epoch:

```
I_n = baseDaily * epochDays * m_n
```

Streamed continuously: every `tick(dt)`, add `I_n * dt / epochDuration` split across live branches pro rata by count, and a branch that opens mid-epoch only receives from `openedAt` forward.

**Placeholder `m` update (must be parameterized).** Public site mentioned range `0.2 .. 1.25`, cuts immediate, raises earned. Implement:

```
params.mMin, params.mMax, params.mLaunch
params.cut:  { type: "immediate", target: "mMin" | "step", step }
params.raise: { type: "earned", step, requireSignalPositive }
```

Default placeholder (document as unpublished):
- `mLaunch = 1.0`
- `mMin = 0.2`
- `mMax = 1.25`

Rules:
- If `F_n <= 0`: `m_{n+1} = max(mMin, m_n - cutStep)` immediately
- If `signal_n > 0` and `F_n > 0`: `m_{n+1} = min(mMax, m_n + raiseStep)`
- Else: unchanged

`cutStep` default `0.25`, `raiseStep` default `0.05` (asymmetric). All in params.

### 4.3 Fee split (WP §11)

Each epoch's ETH income = trading fees + charter auction ETH.

```
70% → active vault (expansion vault if F_n>0 else contraction vault)
15% → POL
15% → teamEth (tracked, not user-claimable in v1)
```

POL 15%: half swapped to $STANDARD at the sim AMM price, paired with remaining ETH, added to full-range POL. POL liquidity tokens never decrease.

Expansion vault: hold ETH; optionally convert to `goldGrams` via `params.ethPerGold` placeholder oracle.

Contraction vault buyback each hour:

```
spend = min(10% of vaultEth, 0.2% of poolEthReserve)
```

Buy $STANDARD from the sim pool, burn 100%. Vault cannot sell gold. Unspent ETH rolls.

Trading fees collected in $STANDARD (if any) burn 100%.

### 4.4 Pool model (v1)

Do not implement a full Uniswap v4. Implement a constant-product AMM with reserves `(eth, std)` initialized so that genesis `GENESIS_POL` $STANDARD is paired with `params.genesisEth`.

Hook accounting:
- `buy $STANDARD` → `ethIn += ethInAmount` (ETH after fee policy: decide `feeBps` on input ETH)
- `sell $STANDARD` → `ethOut += ethLeaving`

Fee: `params.poolFeeBps` on the ETH leg (placeholder e.g. 30 bps). Fee ETH goes to epoch fee bucket, not to LPs in v1 except the 15% POL path at epoch close. Document this simplification.

### 4.5 Charters and branches (WP §6–8)

- Genesis: up to 1000 founding charters in sim, free, 1 per `ownerKey`, each starts with branch 0.
- After genesis flag: daily charter Dutch in ETH, `dailyCap` starts at 0 and is a lab-tunable policy.
- Max 10 branches per charter.
- License auction: `licensesPerDay` default 100, `maxLicensesPerCharterPerDay` = 3, payment 100% $STANDARD burned.
- License open: `P_start = 2 * P_last` (if no sale yesterday, `2 * P_floor`).
- Charter open: `P_start = 3 * P_last` (or `3 * adminFloor`).

Price decay over 24h:

```
P(t) = P_start * (P_floor / P_start) ^ (t / 86400)
```

License `P_floor` placeholder: `params.licenseFloorInStd` or `2 * (I_n / N / epochDays)` (two days of one branch yield). Implement the yield-linked floor as default; keep a min floor param.

Unsold licenses/charters do not roll. `P_last` = last successful sale price that day, else unchanged rule as WP (use last sold base price).

### 4.6 Resolution fee (WP §9)

```
W = $STANDARD withdrawn system-wide in trailing 7 days (minted amounts)
D = sum of all ledger balances still at the bank
P = W / max(D + W, params.exitDenomMin)
feeRate = quadratic map from params.feeFloor to params.feeCeil using P
```

Placeholder quadratic:

```
feeRate = feeFloor + (feeCeil - feeFloor) * P^2
clamp to [feeFloor, feeCeil]
```

Default unpublished: `feeFloor=0.01`, `feeCeil=0.35`, `exitDenomMin=1e18`.

On retire branch `k` with ledger `L`:

```
fee = L * feeRate
mintToUser = L - fee
burn B += fee/2
rebate remaining bankers pro rata by live branch count (or by remaining ledger — pick **live branches**, document choice)
M += mintToUser
retire branch; if last branch, burn charter NFT
```

Quote locks at confirm (`lockedFeeRate` stored on the intent).

---

## 5. Engine interface

### 5.2 Functions (pure-ish; Store wraps World)

```ts
createWorld(params, now): World
tick(world, dtSec): World
applySwap(world, side: "buyStd" | "sellStd", ethOrStd: bigint): World
buyLicense(world, charterId): World
buyCharter(world, ownerKey, payEth): World
retireBranch(world, charterId, branchId): World
checkIn(world, charterId): World
reportDormant(world, charterId, reporterKey): World
closeEpochIfDue(world): World
quoteRetirement(world, charterId, branchId): Quote
quoteLicense(world): { pNow, pFloor, remaining, yourRemainingToday }
invariantCheck(world): { ok: boolean; failures: string[] }
hashWorld(world): string   // stable JSON hash for scenarios
```

**Store in the web app:**

```ts
class SimStore {
  world: World
  apply(fn): void
  subscribe(cb): void
  loadScenario(json): void
  export(): string
}
```

All mutations go through `apply`. UI never writes `world.*` directly.

### Core types

```ts
type Regime = "expansion" | "contraction";

interface Params { /* see section 6 */ }

interface Branch {
  id: number;              // 0..9
  openedAt: number;        // unix seconds
  ledger: bigint;          // accrued unminted STANDARD
  alive: boolean;
}

interface Charter {
  id: string;
  ownerKey: string;
  soulbound: true;
  branches: Branch[];      // length 10, some dead/empty
  lastInteraction: number;
  licensesBoughtToday: number;
  genesis: boolean;
}

interface Auction {
  kind: "license" | "charter";
  day: number;
  pStart: bigint;
  pFloor: bigint;
  pLast: bigint;
  pNow: bigint;
  sold: number;
  cap: number;
  opensAt: number;
  closesAt: number;
}

interface Pool {
  eth: bigint;
  std: bigint;
}

interface Vaults {
  expansionEth: bigint;
  expansionGold: bigint;   // 1e18 = 1 gram placeholder
  contractionEth: bigint;
}

interface World {
  now: number;
  epoch: number;
  epochStartedAt: number;
  params: Params;
  pool: Pool;
  ethInEpoch: bigint;
  ethOutEpoch: bigint;
  F: bigint[];             // history, index = epoch
  m: number;               // use number 0.2..1.25 or store as 1e6 fixed
  issuanceCreditsCum: bigint;
  M: bigint;
  B: bigint;
  vaults: Vaults;
  polEth: bigint;
  polStd: bigint;
  teamEth: bigint;
  feeBucketEth: bigint;    // current epoch unallocated
  licenseAuction: Auction;
  charterAuction: Auction;
  charters: Record<string, Charter>;
  withdrawWindow: { ts: number; amount: bigint }[]; // 7d tape
  invariantsOk: boolean;
  lastError?: string;
}
```

---

## 6. `params.json` schema

`packages/params/default.json`

```json
{
  "meta": {
    "whitepaper": "v0.1",
    "sourceNotes": {
      "mRule": "unpublished_placeholder",
      "baseDaily": "unpublished_placeholder",
      "epochSeconds": "unpublished_placeholder",
      "feeCurve": "unpublished_placeholder"
    }
  },
  "epochSeconds": 86400,
  "baseDailyStd": "100000000000000000000000",
  "mMin": 0.2,
  "mMax": 1.25,
  "mLaunch": 1.0,
  "cutStep": 0.25,
  "raiseStep": 0.05,
  "poolFeeBps": 30,
  "genesisEth": "100000000000000000000",
  "ethPerGoldGram": "200000000000000000",
  "licensesPerDay": 100,
  "maxLicensesPerCharterPerDay": 3,
  "maxBranches": 10,
  "genesisCharterCap": 1000,
  "charterDailyCap": 0,
  "charterAdminFloorEth": "100000000000000000",
  "dormancySeconds": 2592000,
  "dormancyBountyBps": 200,
  "dormancyBountyCapStd": "100000000000000000000",
  "revocationBps": 7000,
  "feeFloor": 0.01,
  "feeCeil": 0.35,
  "exitDenomMin": "1000000000000000000",
  "withdrawWindowSeconds": 604800
}
```

---

## 7. Website information architecture

### 7.1 `/` Landing

Sections:
1. Title: Policy Twin
2. One paragraph: unofficial simulator of the onchain central bank
3. Two CTAs: Open Lab / Enter demo bank #0042
4. Four loops as compact cards (adoption, expansion, fee flow, policy)
5. Footer disclaimer

No wallet modal.

### 7.2 `/lab` God view

Layout: 12-column.

**Left (7 cols): World telemetry**
- Epoch, time remaining, regime
- F_n, signal, m
- S_circ, S_max, M, B, issuance credits / 900M
- Vaults: expansion ETH+gold, contraction ETH
- POL ETH/STD
- Pool spot price
- Invariant pill: OK / FAIL + list

**Right (5 cols): Injectors**
- Swap: side + amount → apply
- Time: +1h / +1 epoch / custom tick
- Spawn genesis charter
- Force policy `charterDailyCap`
- Load scenario dropdown
- Export world JSON
- Reset

**Bottom: charts**
- Net flow bars by epoch
- m step line
- S_circ vs S_max
- Gold vault area

### 7.3 `/bank/:id` Cockpit

**Fixed top strip (Bank health):**
- Regime badge
- Net flow this epoch
- Signal (two closed epochs)
- m now + predicted m next if epoch ended now
- Your live branches / N
- Total ledger
- Heartbeat: time to dormancy

**Main:** Branch rack 2×5 or 10 vertical slots.
- Empty slot: "Buy license — P(t)=… remaining today x/3"
- Live slot: age, ledger, % of system, Retire

**Right rail:**
- License clock (price, decay, sold/100)
- Charter clock (disabled if cap 0)
- Exit pressure: W, D, current feeRate
- What-if drawer

**What-if drawer sliders:**
1. Remaining-epoch ETH flow (net)
2. Licenses I buy today (0–3, cap by slots)
3. Branches I retire this week

On change, clone World, apply hypothetical actions + ticks, do not mutate the live store until user clicks "Commit on live sim." Show 7-epoch ribbon: m, your yield/day, S_circ, gold, feeRate.

**Retire modal:**
- Ledger L
- Locked feeRate
- Mint to you, burn, rebate to others
- If last branch: "Charter burns. Re-entry only via auction."
- Confirm → retireBranch

Check-in button always visible, resets heartbeat.

### 7.4 `/scenarios`

Cards: Inflow week, Exodus, Wash trade, License mania, Ghost purge. Each: description, "Play in Lab", expected teaching point.

### 7.5 `/law`

Table: function | whitepaper section | notes.

---

## 8. Scenario JSON format

`scenarios/exodus.json`

```json
{
  "id": "exodus",
  "title": "Sustained ETH outflow",
  "teach": "Fees flip this epoch; issuance cuts on close; exit fee rises.",
  "paramsOverlay": {},
  "actions": [
    { "t": 0, "op": "seedGenesis", "count": 50 },
    { "t": 0, "op": "tick", "dt": 3600 },
    { "t": 3600, "op": "swap", "side": "sellStd", "amount": "5000000000000000000" },
    { "t": 7200, "op": "retire", "charterId": "c-1", "branchId": 0 }
  ]
}
```

Player in Lab runs `actions` in order, hashing World after each for optional expected hashes later.

**Bundle at least:**
1. `inflow_week`
2. `exodus`
3. `wash_same_epoch` — equal buy+sell, `F_n=0` → contraction fees, issuance not pumped by volume
4. `license_mania`
5. `ghost_purge`

---

## 9. Implementation phases (do in order)

### Phase A — Engine only (no UI)
- Params schema + zod validation
- `createWorld`, pool init with genesis POL
- `applySwap` + fee bucket
- `tick` + epoch close + m update + fee split + contraction ticks
- Charters genesis spawn
- License auction decay + `buyLicense`
- `retireBranch` + withdraw window
- Dormancy
- `invariantCheck`
- Vitest: identities hold after 100 random swaps; wash volume does not increase F_n; last branch burns charter; POL never decreases; contraction vault ETH only falls via buyback burn path

**Exit criterion:** `pnpm test` green on engine.

### Phase B — Store + Lab UI
- React context `SimProvider`
- `/lab` telemetry + injectors + 3 charts
- Scenario loader
- Constants drawer

**Exit criterion:** you can load `exodus` and watch regime flip without console errors.

### Phase C — Cockpit
- Seed demo charter `0042` with 7 branches in default world
- Rack, clocks, retire modal, check-in
- What-if clone engine

**Exit criterion:** Playwright: open `/bank/0042`, buy license (if $STANDARD ledger+pool allows — prefund demo world with ledger and inventory), retire one branch, see `S_max` drop.

### Phase D — Polish
- `/` and `/law`
- Responsive: cockpit usable at 1280px; lab may require desktop
- Screen-reader labels on badges
- README: how to change unpublished params

### Phase E — optional Solidity spec
- `LawMath.sol` for P(t), fee quadratic, spend tick
- Foundry vs TS vectors

Do not start E before C is playable.

---

## 10. Demo world seed (required)

On first load:
- 200 genesis charters (`c-0001` …)
- Charter `c-0042` has 7 live branches with staggered `openedAt`
- Some ledger already accrued (run 2 simulated epochs of inflow in seed)
- License day in progress, 37 sold, price mid-curve
- `charterDailyCap = 0`
- Pool depth healthy (`genesisEth` as in params)

`/bank/0042` must not be an empty shell.

---

## 11. Testing checklist (must implement)

**Engine:**
- `S_circ = 1e8 + M - B` after every op
- `S_max` only decreases
- Volume-matched wash: `ethIn≈ethOut` ⇒ `F_n≈0` ⇒ contraction routing
- Issuance uses `F_{n-1}+F_{n-2}` not current `F_n`
- New branch earns 0 for time before `openedAt`
- 11th branch rejected
- 4th license same day rejected
- License payment added to `B`
- Last branch retire deletes charter
- Report before 30d fails
- Report after 30d: bounty cap works, 70% fee, charter gone
- POL reserve pair never decreases
- `issuanceCreditsCum` cannot exceed budget; then `I_n` base = 0

**UI:**
- Lab invariant pill turns red if you temporarily break a debug toggle (optional debug "break POL" button only in dev)
- What-if does not persist until commit

---

## 12. Repo file tree

```
packages/params/src/schema.ts
packages/params/default.json
packages/engine/src/types.ts
packages/engine/src/params.ts
packages/engine/src/invariants.ts
packages/engine/src/pool.ts
packages/engine/src/auctions.ts
packages/engine/src/issuance.ts
packages/engine/src/exits.ts
packages/engine/src/dormancy.ts
packages/engine/src/epoch.ts
packages/engine/src/store.ts
packages/engine/src/hash.ts
packages/engine/src/index.ts
packages/engine/test/*.test.ts
scenarios/*.json
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/app/lab/page.tsx
apps/web/app/bank/[id]/page.tsx
apps/web/app/scenarios/page.tsx
apps/web/app/law/page.tsx
apps/web/lib/sim-context.tsx
apps/web/components/RegimeBadge.tsx
apps/web/components/BranchRack.tsx
apps/web/components/AuctionClock.tsx
apps/web/components/ExitTicket.tsx
apps/web/components/WhatIfDrawer.tsx
apps/web/components/ConstantsDrawer.tsx
apps/web/components/Charts.tsx
docs/LAW.md
README.md
```

---

## 13. `docs/LAW.md` mapping (create this file)

| Engine | WP |
|---|---|
| `S_circ` / `S_max` | §3 (3.1) (3.2) |
| `F_n`, signal | §4 (4.1) |
| `I_n`, `m` | §5 |
| charter lifecycle | §6 |
| licenses, `P(t)` | §7 (7.1) |
| Dutch open 2× / 3× | §8 |
| resolution fee | §9 (9.1) |
| dormancy | dormancy section |
| 70/15/15, spend_tick | §11 (11.1) |

---

## 14. Claude Code working protocol

When generating code:
1. Implement `packages/engine` and tests before any page.
2. Refuse to put AMM math inside React components.
3. If a whitepaper number is missing, add a param + `unpublished_placeholder` — do not hardcode magic numbers in JSX.
4. Keep commits mentally grouped: engine, lab, cockpit.
5. If stuck on Uniswap v4 fidelity, stay on constant-product + honest comment. Fidelity of **policy accounting** matters more than tick math.
6. Seed `c-0042` so the cockpit is demoable without instructions.

**Acceptance demo script (README):**

```
pnpm i
pnpm test
pnpm --filter web dev
open /lab → load exodus → watch contraction
open /bank/0042 → open what-if → raise outflows → fee ribbon up
retire a non-last branch → S_max falls
check-in → heartbeat resets
```

That is the entire architecture. Build Phase A first and do not open `/bank` until `invariantCheck` is tested.
