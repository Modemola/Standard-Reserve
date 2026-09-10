# Phase 2 — Hook Sentinel + Open Market Desk

Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md), which stays the master spec
for the Policy Twin and the Banker's Cockpit. Nothing here forks that design:
both new surfaces run on the same `packages/engine`, the same `World`, and the
same `SimStore`.

> Unofficial simulator. Not The Standard Reserve team. Not a bank. Not advice.
> Attacks are against the local engine, not mainnet.

## What was added

| Surface | Audience | Powers |
|---|---|---|
| `/sentinel` | Auditors, sceptics | Replay hostile fixtures against the engine and read the verdicts |
| `/desk` | Bankers | Prices for the only legal moves: flip the sign, take a licence, pay the run tax |

```
packages/sentinel/   attack fixtures + runner + report (zero React)
packages/desk/       pure quote/solver functions (zero React)
attacks/             14 attack fixtures, A1..A14
artifacts/           generated sentinel-report.md (gitignored)
```

Dependency direction is one-way: `sentinel` and `desk` both depend on
`engine`, never the reverse.

## Engine changes this phase required

Three, all additive and all covered by the existing suite.

**1. An optional trace sink on `tick`.** A4 and A12 assert that *every hourly*
contraction buyback stays inside `min(10% of vault, 0.2% of pool)`. That is
invisible from outside, because one `tick(86400)` call replays 24 buyback hours
internally. Rather than let the Desk fake a vault — explicitly ruled out by
§14.3 — `tick(world, dt, trace?)` now threads an optional `EngineTrace` down to
`runContractionBuyback`, which records `{t, vaultBefore, poolEthBefore, spend,
burned}` per hour.

The trace is a passive sink, not World state, so `hashWorld` is unchanged and
every previously recorded hash still matches.

**2. `params.floorEpsilon`.** The Desk's "floor" plan needs a tolerance for how
close to `P_floor` counts as *at* the floor. It is relative (default `0.01`, so
within 1%), which holds at any price scale, and it is tagged in
`meta.sourceNotes` as an implementation default — it prices a display row, not
policy. It is the second such addition, after `licenseMinFloorStd`.

**3. A tape on `SimStore`.** `apply(fn, op?)` now appends a `TapeRow` capped at
200 rows. The row's numbers are derived by diffing the World before and after,
never taken from the caller, so an unlabelled call still records correct
figures; `op` is a display label only. Lab, Desk and the cockpit share one
buffer, which is why the Desk's pool tape shows prints made anywhere else.

`TapeRow` lives in `packages/engine` rather than `packages/sentinel`, because
both `SimStore` and `packages/desk` consume it and the engine is the only
package both can depend on.

## Deliberate deviations from the Phase 2 spec

**`SimStore` does not carry `Verdict`.** §9 sketches `runAttack`,
`runAllAttacks` and `lastVerdicts` on the store. `Verdict` is Sentinel's type
and Sentinel depends on the engine, so putting it on `SimStore` would make the
dependency graph circular. Instead the engine gained the type-agnostic
`applyWorld(world, op?)` — everything "Replay in Lab" actually needs — and the
verdict state lives in `/sentinel`, which is free to depend on both packages.

**A2 asserts `mAtMost`, not shadow-world equality.** §6 suggests encoding the
one-block pump as "m after close equals a control world that skipped the
pump". Run it and that comparison fails for the wrong reason: without the pump
the epoch closes at `F_n = 0` and takes a *cut*, so the control lands lower.
The pump did not raise the multiplier, it skipped one cut — the two are not the
same thing, and only the first is an attack. The fixture therefore pins the
real property (`mMustNotIncrease` plus an exact `mAtMost`), and
`test/A2.test.ts` proves the structural claim against a control run: with the
pump `m` never rises above its pre-close value, and the control sits strictly
lower. §6 explicitly permits this fallback.

**Two expectation fields exist to stop vacuous passes.** `minBuybackTicks`
guards the per-tick buyback bounds — "every hour respected the cap" is
trivially true when no hour ran, and A1 turned out to run 24 buyback hours
while a first draft of A4's probe ran none. `sMaxMustDecrease` proves something
actually burned, since `S_max = HARD_CAP - B` only falls on a burn.

## Verdicts

- **HELD** — the rule stopped the attack.
- **CHEAP** — allowed, and the incentive is worth naming. Never fails CI.
- **BROKEN** — an invariant or a stated expectation failed.
- **PENDING** — listed in `/attacks` but not implemented.

`shouldFail` gates CI on broken *rules*, never on yellow findings — but an
incentive fixture that breaks a real invariant still fails the run, because
that is an engine bug whichever fixture tripped it.

## Current state

All 14 attacks run clean: **11 HELD, 3 CHEAP, 0 BROKEN**. The three yellows are
findings worth reading rather than bugs:

- `A3_split_across_epochs` — a raise is a sign test, not a size test, so 0.3 ETH
  spread across three closes walks the multiplier up.
- `A5_fee_switch_jitter` — the regime threshold is exactly zero with no
  deadband. Measured on two runs identical but for a single wei: an epoch
  closing at `F_n = 0` routes 70% of its fee income to the *contraction* vault
  and takes the multiplier cut; at `F_n = +1 wei` the *expansion* vault takes
  it and the multiplier is held. Whoever moves last before the bell chooses
  both. `test/A5.test.ts` runs both sides.
- `A14_spot_oracle_toy` — `ethPerGoldGram` is declared but unwired; the
  expansion vault holds ETH and never converts, so the gold column is not a
  reserve claim.

## Running it

```
pnpm test            # engine + sentinel + desk unit suites
pnpm sentinel:run    # verdict table -> artifacts/sentinel-report.md, exit 1 on BROKEN
pnpm --filter web dev
```

## How this sits next to the adversarial probes

`packages/engine/src/adversary.ts` (`pnpm attack`) already asks a different
question — not "does the rule hold" but "does a strategy profit". Its headline
is that **the pump works**: a sustained pump drives `m` to its ceiling and
harvests materially more issuance than a passive control, and what stops it
paying is a ~47% round-trip slippage cost through a 100 ETH pool — a defence
that weakens as the pool deepens.

That is not in tension with `A2_one_block_pump` coming back HELD, and the two
should be read together:

- **A2 is the single-epoch case.** One last-minute buy cannot earn a raise,
  because the raise path reads the two *previously closed* epochs. The most it
  buys is skipping one cut.
- **A3 is the mechanism that does work**, marked CHEAP precisely because it
  does: consecutive positive closes walk `m` up regardless of size.
- **The adversary probes price it.** Sentinel answers "is the rule enforced";
  the probes answer "is enforcing it enough". A3's yellow note and A2's teach
  text both point at `pnpm attack` so nobody reads a HELD verdict as "pumping
  is impossible".

The honest summary is that the multiplier rule is enforced exactly as written,
and that being enforced is not the same as being sufficient.
