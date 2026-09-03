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
| resolution fee | §9 (9.1) | `packages/engine/src/exits.ts` — `computeFeeRate`, `retireBranch` |
| dormancy | dormancy section | `packages/engine/src/dormancy.ts` — `checkIn`, `reportDormant` |
| 70/15/15, spend_tick | §11 (11.1) | `packages/engine/src/epoch.ts` — `splitFees`; `runContractionBuyback` |

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
