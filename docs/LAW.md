# LAW — engine ↔ whitepaper mapping

Per `docs/ARCHITECTURE.md` §13. This table is the audit trail from what the
engine actually computes back to the whitepaper section it implements. The
same table renders live at `/law` in the app (`apps/web/lib/law-mapping.ts`
is the source of truth for that page; keep the two in sync when either
changes).

| Engine | WP | Notes |
|---|---|---|
| `S_circ` / `S_max` | §3 (3.1) (3.2) | `packages/engine/src/invariants.ts` — `supplyCirc`, `supplyMax` |
| `F_n`, signal | §4 (4.1) | `packages/engine/src/epoch.ts` — `closeOneEpoch` |
| `I_n`, `m` | §5 | `packages/engine/src/issuance.ts` (`computeEpochIssuance`, `streamIssuance`); `epoch.ts` (`updateM`) |
| charter lifecycle | §6 | `packages/engine/src/auctions.ts` — `createCharter`, `buyCharter` |
| licenses, `P(t)` | §7 (7.1) | `packages/engine/src/auctions.ts` — `dutchPrice`, `buyLicense`, `licenseFloor` |
| Dutch open 2× / 3× | §8 | `packages/engine/src/auctions.ts` — `rollOneDay` |
| resolution fee | §9 (9.1) | `packages/engine/src/exits.ts` — `computeFeeRate`, `feeRateFromP`, `retireBranch` |
| dormancy | dormancy section | `packages/engine/src/dormancy.ts` — `checkIn`, `reportDormant` |
| 70/15/15, spend_tick | §11 (11.1) | `packages/engine/src/epoch.ts` — `splitFees`; `runContractionBuyback`, `contractionSpend` |

### Phase E — Solidity twins (audit narrative only, never deployed)

`contracts/law/src/LawMath.sol` re-implements three of the above pure
formulas in Solidity, checked against shared vectors generated from the
live engine (`packages/engine/scripts/generate-law-vectors.ts` →
`contracts/law/test/vectors/*.json`, consumed by
`contracts/law/test/LawMath.t.sol`):

| `LawMath.sol` | Engine equivalent |
|---|---|
| `dutchPrice` | `auctions.ts` — `dutchPrice` |
| `resolutionFeeRate` | `exits.ts` — `feeRateFromP` |
| `contractionSpend` | `epoch.ts` — `contractionSpend` |

`dutchPrice` is not bit-exact between the two (IEEE-754 `Math.pow` in TS vs.
PRBMath's fixed-point `ln`/`exp`-based `pow` in Solidity) — vectors assert
agreement within a small relative tolerance, not equality. See the
comment atop `LawMath.sol`.

## Known simplifications (documented, not hidden)

These are v1 implementation choices where the whitepaper is silent or where
full fidelity (real Uniswap v4 hooks, real LP positions) was explicitly
out of scope per `docs/ARCHITECTURE.md` §2 and §14.5:

- **Pool model** — a single constant-product AMM (`pool.ts`), not Uniswap
  v4. Trading/auction fees route to the epoch fee bucket, not directly to
  LPs, except via the 15% POL path at epoch close.
- **POL conversion** — the "half swapped to $STANDARD" leg executes a real
  swap against the sim pool (moving its reserves); `polEth`/`polStd` are
  tracked as a separate, monotonically-increasing ledger rather than a
  literal LP position, since v1 has no concentrated-liquidity model.
- **License floor** — `params.licenseMinFloorStd` is an engine-only
  addition (WP leaves the license floor's minimum unspecified beyond
  "keep a min floor param," per §7.1's implementation note).
- **Dormancy revocation** — modeled as charter-wide (all live branches
  revoked together), matching the single heartbeat shown in the cockpit.
  The non-fee remainder of a revoked ledger is forfeited (never minted to
  anyone) rather than credited, since the owner abandoned it.
- **Contraction buyback cadence** — literally hourly, replayed in
  whole-hour steps inside `tick()`/`runContractionBuyback` so large time
  jumps in the Lab still produce the correct cumulative burn.

Every numeric placeholder used above is declared in
`packages/params/default.json` under `meta.sourceNotes` and marked
`unpublished_placeholder` (or an explicit implementation-default note) —
see `docs/ARCHITECTURE.md` §6.

---

## Phase 2 — Sentinel attacks

Each fixture in `/attacks` leans on one of the rules above. HELD means the rule
stopped it; CHEAP means it was allowed and the incentive is worth naming.
Run them with `pnpm sentinel:run`, or on `/sentinel`.

| Attack | WP | What it leans on |
|---|---|---|
| `A1_wash_volume` | §4 (4.1) | Volume is not flow: a round trip nets to zero and still takes the cut |
| `A2_one_block_pump` | §5 | Signal reads F_{n-1}+F_{n-2}, never the epoch being pumped |
| `A3_split_across_epochs` | §5 | Raises are a sign test, not a size test *(CHEAP)* |
| `A4_contraction_bait` | §11 (11.1) | Every buyback hour capped at min(10% vault, 0.2% pool) |
| `A5_fee_switch_jitter` | §4 (4.1) | Zero is the only regime threshold — no deadband *(CHEAP)* |
| `A6_license_sniper` | §7-8 | 3 licences per charter per day; 10 branches; inventory does not roll |
| `A7_license_inventory` | §7 | Licence payments burn; no ledger is debited to pay for one |
| `A8_exit_run` | §9 | The run tax climbs with the crowd, and no exit is ever paused |
| `A9_self_rebate` | §9 | Rebate reaches the stayers only; the last branch burns the charter |
| `A10_ghost_grief` | dormancy | 30-day window is exact; bounty is capped; charter is revoked |
| `A11_false_checkin_grief` | dormancy | Check-in resets the heartbeat, so an active bank cannot be reported |
| `A12_pol_rug` | §11 | POL only grows — the engine has no withdrawal path at all |
| `A13_issuance_budget` | §3 | Base issuance stops at the 900M credit cap; fees keep flowing |
| `A14_spot_oracle_toy` | §11 | `ethPerGoldGram` is declared but unwired *(CHEAP)* |

## Phase 2 — Open Market Desk quotes

Every Desk quote is a pure function of a cloned world, so reading a price can
never change one.

| Quote | WP | Notes |
|---|---|---|
| `flipQuote` | §4, sign(F_n) | `packages/desk/src/flip.ts` — zero net is already contraction, so flipping to expansion costs one wei more than closing the gap |
| `licensePlans` | §7 (7.1), P(t) | `packages/desk/src/licensePlans.ts` — now / wait / floor, each simulated on a clone; legality comes from the engine's own `buyLicense` so it cannot drift from the Cockpit |
| `charterBoard` | §8, 3× / cap 0 | `packages/desk/src/charterBoard.ts` — a closed book returns no price field at all |
| `exitImpact` | §9 (9.1) | `packages/desk/src/exitImpact.ts` — the run tax now, plus the crowded-door version |

## Additional Phase 2 simplifications

- **`floorEpsilon`** is an implementation default, not a policy constant. It is
  a *relative* tolerance (1%) for how close to `P_floor` the Desk's "floor" row
  counts as being at the floor. It prices a display row and nothing else.
- **The engine trace** (`tick(world, dt, trace?)`) is passive instrumentation.
  It records each hourly buyback so Sentinel can audit the per-tick bound; it
  is not part of `World` and does not affect `hashWorld`.
- **`SimStore.tape`** derives every row by diffing the World before and after a
  mutation. The `op` label is cosmetic — the figures cannot be faked by a
  mislabelled call site.
