// Replay one attack fixture against the real engine and judge what happened.
//
// Two rules keep this honest:
//   1. Every action goes through an exported engine function. Sentinel never
//      reimplements pool, fee or auction math — if it needs a swap size it
//      binary-searches the engine's own sellStd.
//   2. A throw is never a pass. If the engine explodes, the verdict is broken
//      and carries the message.
import {
  DEFAULT_RAW_PARAMS,
  applySwap,
  buyCharter,
  buyLicense,
  checkIn,
  computeFeeRate,
  createTrace,
  createWorld,
  hashWorld,
  invariantCheck,
  liveNetFlow,
  loadParamsWithOverlay,
  quoteCharterPrice,
  regimeIfEpochEndedNow,
  regimeNow,
  reportDormant,
  retireBranch,
  seedGenesis,
  sellStd,
  supplyMax,
  supplyCirc,
  tapeRowFrom,
  tick,
} from "@standard-law/engine";
import type { EngineTrace, Pool, TapeRow, World } from "@standard-law/engine";
import type { RawParams } from "@standard-law/params";
import type { AttackAction, AttackFixture, Snapshot, Verdict, VerdictStatus } from "./schema.js";

/** Genesis charters minted by each named seed. "c-0042" matches the demo world's id space. */
const SEED_CHARTERS: Record<AttackFixture["seed"], number> = {
  empty: 0,
  default: 50,
  "c-0042": 200,
};

function countLiveBranches(world: World): number {
  let n = 0;
  for (const charter of Object.values(world.charters)) {
    if (!charter.alive) continue;
    for (const b of charter.branches) if (b.alive) n++;
  }
  return n;
}

/** Signal as it stands for the next epoch close: F_{n-1} + F_{n-2}. Matches the Lab readout. */
function signalOf(world: World): bigint {
  const f = world.F;
  const a = f.length >= 1 ? f[f.length - 1] : 0n;
  const b = f.length >= 2 ? f[f.length - 2] : 0n;
  return a + b;
}

export function snapshotOf(world: World): Snapshot {
  return {
    epoch: world.epoch,
    regime: regimeNow(world),
    m: world.m,
    Fn: liveNetFlow(world).toString(),
    signal: signalOf(world).toString(),
    S_circ: supplyCirc(world).toString(),
    S_max: supplyMax(world).toString(),
    polEth: world.polEth.toString(),
    polStd: world.polStd.toString(),
    expansionEth: world.vaults.expansionEth.toString(),
    expansionGold: world.vaults.expansionGold.toString(),
    contractionEth: world.vaults.contractionEth.toString(),
    N: countLiveBranches(world),
  };
}

/**
 * Smallest $STANDARD input whose ETH-out lands closest to `target`, found by
 * bisecting the engine's own sellStd. Used to put a wash trade exactly on
 * F_n = 0 instead of leaving the fee asymmetry behind as fake inflow.
 */
export function solveSellForEthOut(pool: Pool, feeBps: number, target: bigint): bigint {
  const out = (x: bigint) => sellStd(pool, x, feeBps).amountOut;
  let lo = 1n;
  let hi = pool.std;
  if (out(hi) < target) return hi; // pool cannot pay that much out; the checks will catch it
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (out(mid) >= target) hi = mid;
    else lo = mid + 1n;
  }
  if (lo > 1n) {
    const over = out(lo) - target;
    const under = target - out(lo - 1n);
    if (under < over) return lo - 1n;
  }
  return lo;
}

function buildWorld(fixture: AttackFixture): World {
  const params = loadParamsWithOverlay(
    DEFAULT_RAW_PARAMS,
    fixture.paramsOverlay as Partial<RawParams>,
  );
  let world = createWorld(params, 0);
  const charters = SEED_CHARTERS[fixture.seed];
  if (charters > 0) world = seedGenesis(world, charters);
  return world;
}

function applyAction(world: World, a: AttackAction, trace: EngineTrace): [World, string] {
  switch (a.op) {
    case "seedGenesis":
      return [seedGenesis(world, a.count ?? 0), "seedGenesis"];
    case "tick":
      return [tick(world, a.dt ?? 0, trace), "tick"];
    case "setNow":
      // Always forward, always through tick — a raw clock jump would skip
      // issuance, epoch closes and buybacks, which would flatter the engine.
      return [a.t > world.now ? tick(world, a.t - world.now, trace) : world, "setNow"];
    case "fastForwardEpochs":
      return [tick(world, (a.epochs ?? 0) * world.params.epochSeconds, trace), "fastForwardEpochs"];
    case "swap": {
      const side = a.side ?? "buyStd";
      const amount =
        a.targetEthOut !== undefined
          ? solveSellForEthOut(world.pool, world.params.poolFeeBps, BigInt(a.targetEthOut))
          : BigInt(a.amount ?? "0");
      return [applySwap(world, side, amount), side];
    }
    case "buyLicense":
      return [buyLicense(world, a.charterId ?? ""), "buyLicense"];
    case "buyCharter": {
      const pay = a.amount !== undefined ? BigInt(a.amount) : quoteCharterPrice(world);
      return [buyCharter(world, a.ownerKey ?? "attacker", pay), "buyCharter"];
    }
    case "retire":
      return [retireBranch(world, a.charterId ?? "", a.branchId ?? 0), "retire"];
    case "checkIn":
      return [checkIn(world, a.charterId ?? ""), "checkIn"];
    case "reportDormant":
      return [reportDormant(world, a.charterId ?? "", a.reporterKey ?? "reporter"), "reportDormant"];
    case "setCharterCap": {
      // The same lab-tunable policy lever the Lab exposes; not a second World.
      const cap = a.cap ?? 0;
      return [
        {
          ...world,
          params: { ...world.params, charterDailyCap: cap },
          charterAuction: { ...world.charterAuction, cap },
        },
        "setCharterCap",
      ];
    }
  }
}

interface RunOutput {
  world: World;
  tape: TapeRow[];
  trace: EngineTrace;
  feeRateStart: number;
  feeRateEnd: number;
  mIncreased: boolean;
  regimeFlips: number;
  lastError?: string;
  /** Every rejection reason the engine produced, in order. */
  rejections: string[];
}

function replay(fixture: AttackFixture, world0: World): RunOutput {
  const trace = createTrace();
  const tape: TapeRow[] = [];
  let world = world0;
  const feeRateStart = computeFeeRate(world);
  const mStart = world.m;
  let regimeFlips = 0;
  let lastRegime = regimeIfEpochEndedNow(world);
  const rejections: string[] = [];

  for (const action of fixture.actions) {
    if (action.t > world.now) {
      const beforeTick = world;
      world = tick(world, action.t - world.now, trace);
      tape.push(tapeRowFrom(beforeTick, world, "tick"));
    }
    const before = world;
    const [next, label] = applyAction(world, action, trace);
    world = next;
    if (world.lastError) rejections.push(world.lastError);
    const row = tapeRowFrom(before, world, label);
    if (action.note) row.note = row.note ? `${row.note}; ${action.note}` : action.note;
    tape.push(row);
    if (row.regime && row.regime !== lastRegime) {
      regimeFlips += 1;
      lastRegime = row.regime;
    }
  }

  return {
    world,
    tape,
    trace,
    feeRateStart,
    feeRateEnd: computeFeeRate(world),
    mIncreased: world.m > mStart,
    regimeFlips,
    lastError: world.lastError,
    rejections,
  };
}

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

/** fraction is a small decimal (0.10, 0.002); scale to 1e9 to stay in bigint. */
function fracOf(v: bigint, fraction: number): bigint {
  const scaled = BigInt(Math.round(fraction * 1e9));
  return (v * scaled) / 1_000_000_000n;
}

function ledgerOf(world: World, charterId: string): bigint {
  const c = world.charters[charterId];
  if (!c) return 0n;
  let total = 0n;
  for (const b of c.branches) if (b.alive) total += b.ledger;
  return total;
}

/** Every expectation check. Each returns a human-readable message when it misses. */
function checkExpectations(fixture: AttackFixture, run: RunOutput, before: World): string[] {
  const e = fixture.expect;
  const w = run.world;
  const miss: string[] = [];

  if (e.regimeAfter !== undefined && regimeNow(w) !== e.regimeAfter) {
    miss.push(`regimeAfter: expected ${e.regimeAfter}, got ${regimeNow(w)}`);
  }
  if (e.fnAbsMax !== undefined) {
    const cap = BigInt(e.fnAbsMax);
    // Every epoch this run closed, plus the one still open. Checking only the
    // live epoch would let an attack hide its flow by closing the epoch.
    const closed = w.F.slice(before.F.length);
    for (let i = 0; i < closed.length; i++) {
      const fn = abs(closed[i]);
      if (fn > cap) {
        miss.push(`fnAbsMax: epoch ${before.epoch + i} closed at |F_n| = ${fn}, over ${e.fnAbsMax}`);
      }
    }
    const live = abs(liveNetFlow(w));
    if (live > cap) miss.push(`fnAbsMax: open epoch |F_n| = ${live}, over ${e.fnAbsMax}`);
  }
  if (e.mMustNotIncrease && w.m > before.m) {
    miss.push(`mMustNotIncrease: m rose ${before.m} -> ${w.m}`);
  }
  if (e.mAtMost !== undefined && w.m > e.mAtMost) {
    miss.push(`mAtMost: m is ${w.m}, over ${e.mAtMost}`);
  }
  if (e.polMustNotDecrease) {
    if (w.polEth < before.polEth) {
      miss.push(`polMustNotDecrease: polEth fell ${before.polEth} -> ${w.polEth}`);
    }
    if (w.polStd < before.polStd) {
      miss.push(`polMustNotDecrease: polStd fell ${before.polStd} -> ${w.polStd}`);
    }
  }
  if (e.vaultGoldMustNotDecrease && w.vaults.expansionGold < before.vaults.expansionGold) {
    miss.push(
      `vaultGoldMustNotDecrease: gold fell ${before.vaults.expansionGold} -> ${w.vaults.expansionGold}`,
    );
  }
  if (e.sMaxMustNotIncrease && supplyMax(w) > supplyMax(before)) {
    miss.push(`sMaxMustNotIncrease: S_max rose ${supplyMax(before)} -> ${supplyMax(w)}`);
  }
  if (e.sMaxMustDecrease && supplyMax(w) >= supplyMax(before)) {
    miss.push(`sMaxMustDecrease: nothing burned, S_max still ${supplyMax(w)}`);
  }
  if (e.polMustIncrease && !(w.polEth > before.polEth || w.polStd > before.polStd)) {
    miss.push("polMustIncrease: neither POL leg grew");
  }

  if (e.minBuybackTicks !== undefined && run.trace.buybacks.length < e.minBuybackTicks) {
    miss.push(
      `minBuybackTicks: only ${run.trace.buybacks.length} buyback hours ran, ` +
        `expected at least ${e.minBuybackTicks} — the per-tick bounds would pass vacuously`,
    );
  }

  // Per-hour buyback bounds, read straight off the engine trace.
  for (const b of run.trace.buybacks) {
    if (e.maxSpendFractionOfVaultPerTick !== undefined) {
      const limit = fracOf(b.vaultBefore, e.maxSpendFractionOfVaultPerTick);
      if (b.spend > limit) {
        miss.push(
          `buyback t=${b.t}: spend ${b.spend} over ${e.maxSpendFractionOfVaultPerTick} of vault (${limit})`,
        );
      }
    }
    if (e.maxSpendFractionOfPoolPerTick !== undefined) {
      const limit = fracOf(b.poolEthBefore, e.maxSpendFractionOfPoolPerTick);
      if (b.spend > limit) {
        miss.push(
          `buyback t=${b.t}: spend ${b.spend} over ${e.maxSpendFractionOfPoolPerTick} of pool (${limit})`,
        );
      }
    }
  }

  if (e.lastErrorContains !== undefined) {
    const err = run.lastError ?? "";
    if (!err.includes(e.lastErrorContains)) {
      miss.push(`lastErrorContains: expected "${e.lastErrorContains}", got "${err || "(none)"}"`);
    }
  }
  if (e.rejectionsInclude !== undefined) {
    for (const want of e.rejectionsInclude) {
      if (!run.rejections.some((r) => r.includes(want))) {
        miss.push(
          `rejectionsInclude: never saw "${want}" — engine rejected [${run.rejections.join(", ") || "nothing"}]`,
        );
      }
    }
  }
  if (e.lastActionSucceeds && run.lastError) {
    miss.push(`lastActionSucceeds: engine rejected it with "${run.lastError}"`);
  }
  if (e.feeRateMustRise && run.feeRateEnd <= run.feeRateStart) {
    miss.push(`feeRateMustRise: ${run.feeRateStart} -> ${run.feeRateEnd}`);
  }
  if (e.feeRateAtMost !== undefined && run.feeRateEnd > e.feeRateAtMost) {
    miss.push(`feeRateAtMost: ${run.feeRateEnd} exceeds ${e.feeRateAtMost}`);
  }
  if (e.charterGone !== undefined) {
    const c = w.charters[e.charterGone];
    if (c && c.alive) miss.push(`charterGone: ${e.charterGone} is still alive`);
  }
  if (e.charterAlive !== undefined) {
    const c = w.charters[e.charterAlive];
    if (!c || !c.alive) miss.push(`charterAlive: ${e.charterAlive} is gone`);
  }
  if (e.ledgerUnchangedFor !== undefined) {
    const id = e.ledgerUnchangedFor;
    if (ledgerOf(w, id) !== ledgerOf(before, id)) {
      miss.push(`ledgerUnchangedFor ${id}: ${ledgerOf(before, id)} -> ${ledgerOf(w, id)}`);
    }
  }
  if (e.maxLiveBranchesFor !== undefined) {
    const c = w.charters[e.maxLiveBranchesFor];
    const live = c ? c.branches.filter((b) => b.alive).length : 0;
    if (live > w.params.maxBranches) {
      miss.push(`maxLiveBranchesFor ${e.maxLiveBranchesFor}: ${live} > ${w.params.maxBranches}`);
    }
  }
  if (e.issuanceCreditsAtMost !== undefined) {
    const cap = BigInt(e.issuanceCreditsAtMost);
    if (w.issuanceCreditsCum > cap) {
      miss.push(`issuanceCreditsAtMost: ${w.issuanceCreditsCum} exceeds ${cap}`);
    }
  }
  if (e.baseIssuanceStopped) {
    // One more epoch must not credit any further base issuance.
    const probe = tick(w, w.params.epochSeconds);
    if (probe.issuanceCreditsCum > w.issuanceCreditsCum) {
      miss.push(
        `baseIssuanceStopped: credits still climbing ${w.issuanceCreditsCum} -> ${probe.issuanceCreditsCum}`,
      );
    }
  }
  return miss;
}

function yellowApplies(fixture: AttackFixture, run: RunOutput): boolean {
  if (!fixture.expect.notesYellow) return false;
  switch (fixture.expect.yellowWhen ?? "always") {
    case "mIncreased":
      return run.mIncreased;
    case "regimeFlipped":
      return run.regimeFlips >= 2;
    default:
      return true;
  }
}

function pendingVerdict(fixture: AttackFixture): Verdict {
  const empty = snapshotOf(createWorld(loadParamsWithOverlay(DEFAULT_RAW_PARAMS, {}), 0));
  return {
    id: fixture.id,
    wp: fixture.wp,
    title: fixture.title,
    teach: fixture.teach,
    severity: fixture.severity,
    status: "pending",
    broken: [],
    unexpected: [],
    before: empty,
    after: empty,
    tape: [],
    notes: "Fixture listed but not implemented yet.",
    worldHashAfter: "",
  };
}

export function runFixture(fixture: AttackFixture): Verdict {
  if (!fixture.implemented) return pendingVerdict(fixture);

  const world0 = buildWorld(fixture);
  const before = snapshotOf(world0);

  let run: RunOutput;
  try {
    run = replay(fixture, world0);
  } catch (err) {
    // An engine throw is a finding, never a pass.
    return {
      id: fixture.id,
      wp: fixture.wp,
      title: fixture.title,
      teach: fixture.teach,
      severity: fixture.severity,
      status: "broken",
      broken: ["engine threw"],
      unexpected: [],
      before,
      after: before,
      tape: [],
      notes: err instanceof Error ? err.message : String(err),
      worldHashAfter: "",
    };
  }

  const inv = invariantCheck(run.world);
  const broken = fixture.expect.invariantsOk === false ? [] : [...inv.failures];
  const unexpected = checkExpectations(fixture, run, world0);

  const yellow = yellowApplies(fixture, run);
  let status: VerdictStatus;
  if (broken.length > 0) status = "broken";
  else if (unexpected.length > 0) status = fixture.severity === "invariant" ? "broken" : "cheap";
  else status = yellow ? "cheap" : "held";

  return {
    id: fixture.id,
    wp: fixture.wp,
    title: fixture.title,
    teach: fixture.teach,
    severity: fixture.severity,
    status,
    broken,
    unexpected,
    before,
    after: snapshotOf(run.world),
    tape: run.tape,
    notes: yellow && fixture.expect.notesYellow ? fixture.expect.notesYellow : "",
    worldHashAfter: hashWorld(run.world),
  };
}

/** The after-world of a fixture, for "Replay in Lab". */
export function runFixtureWorld(fixture: AttackFixture): World {
  return replay(fixture, buildWorld(fixture)).world;
}
