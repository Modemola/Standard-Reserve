// Parameter sweeps — run many worlds across ranges of the policy constants
// and report where the policy degenerates.
//
// The Lab drives one world down one path. That shows you what the policy
// *did*, never whether it is sound. This module answers the other question:
// across a grid of parameter values, which settings produce a monetary system
// that still works, and which produce one that has quietly stopped doing
// anything?
//
// Two rules make the output mean something:
//
//   1. Every cell runs the *identical* workload. If each world saw different
//      trades, a difference between cells would be noise rather than the
//      parameter. Workloads are therefore deterministic and seeded, and the
//      same seed is used for every cell in a run.
//
//   2. A verdict describes a *structural* failure — issuance permanently off,
//      the budget gone, liquidity never forming — not a judgement about
//      whether a number is "good". Several constants in this repo are still
//      unpublished placeholders, so a sweep can tell you about the shape of
//      the model; it cannot tell you the real protocol is well calibrated.
import { DAY_SECONDS, ISSUANCE_BUDGET } from "./constants.js";
import { applySwap, createWorld, seedGenesis, tick } from "./store.js";
import { supplyCirc, supplyMax } from "./invariants.js";
import type { Params, World } from "./types.js";

/** Deterministic PRNG, so a run is reproducible from its seed alone. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const ETH = 1_000_000_000_000_000_000n;

export interface Workload {
  readonly name: string;
  /** What market condition this represents, for the report. */
  readonly description: string;
  /**
   * Build one run's day function. A factory rather than a plain function so a
   * workload can carry state between days -- `choppy` needs it to sell back
   * exactly what it bought, which is what makes it genuinely directionless.
   */
  readonly make: () => (world: World, dayIndex: number, rng: () => number) => World;
  /**
   * What a sound policy is supposed to do under this market. Degeneracy is
   * relative to the market, not absolute -- the first version of this module
   * judged every cell by the same rules and reported that sustained inflow
   * pinning m to its ceiling was a failure. It is not: that is the policy
   * working. Only the same outcome under an *outflow* would be a failure.
   */
  readonly expect: {
    /** Should the regime flip at least once? False for monotonic markets. */
    readonly regimeChanges: boolean;
    /** Where m ought to end up if the policy is responding at all. */
    readonly m: "rises" | "falls" | "stays off the rails";
  };
}

/**
 * The three market conditions worth asking about. Between them they cover the
 * regimes the policy claims to handle: sustained growth, a shock, and
 * directionless churn (which must not be read as growth).
 */
export const WORKLOADS: Record<string, Workload> = {
  steady_inflow: {
    name: "steady_inflow",
    description: "Consistent daily net buying — the case the policy exists to reward.",
    make: () => (world, _i, rng) =>
      applySwap(world, "buyStd", ETH + BigInt(Math.floor(rng() * 2e18))),
    // Never contracts, by construction. m riding the ceiling is the intended
    // outcome here, so neither is reported as a defect.
    expect: { regimeChanges: false, m: "rises" },
  },
  outflow_shock: {
    name: "outflow_shock",
    description: "A fortnight of inflow, then sustained heavy selling.",
    make: () => (world, i, rng) =>
      i < 14
        ? applySwap(world, "buyStd", ETH * 2n + BigInt(Math.floor(rng() * 1e18)))
        : applySwap(world, "sellStd", BigInt(Math.floor(rng() * 4e21)) + 1_000n * ETH),
    // The interesting one: m must actually come down when the flow reverses.
    // A cell that keeps m at the ceiling through this has a cut that never bit.
    expect: { regimeChanges: true, m: "falls" },
  },
  choppy: {
    name: "choppy",
    description: "Directionless churn — volume without direction, which must not read as growth.",
    // Genuinely directionless, and this took two attempts to get right. The
    // first version flipped a coin each day and drew buy and sell magnitudes
    // independently, in different units (ETH in, STD out) -- so whether a run
    // drifted up or down was itself a function of the seed, and the sweep
    // reported a "finding" that vanished on 3 seeds out of 5.
    //
    // Now: buy on even days, sell back exactly what that buy produced on odd
    // days. Direction is fixed by parity rather than by chance, and the two
    // legs match in size, so the only net drift is the pool fee -- which is a
    // real cost, not a trend.
    make: () => {
      let owed = 0n;
      return (world, i, rng) => {
        if (i % 2 === 0) {
          const before = world.pool.std;
          const next = applySwap(world, "buyStd", ETH + BigInt(Math.floor(rng() * 1e18)));
          owed = before - next.pool.std;
          return next;
        }
        if (owed <= 0n) return world;
        const next = applySwap(world, "sellStd", owed);
        owed = 0n;
        return next;
      };
    },
    // Churn is not direction. A policy that reads noise as a trend and parks
    // against either rail is over-reacting to volume.
    expect: { regimeChanges: true, m: "stays off the rails" },
  },
};

/** Everything a single swept world reports about itself. */
export interface CellMetrics {
  /** Fraction of closed epochs spent with m at its floor / ceiling. */
  timeAtFloor: number;
  timeAtCeiling: number;
  mFinal: number;
  epochsClosed: number;
  /** Share of the 900M issuance budget consumed by the horizon. */
  budgetUsed: number;
  polEth: bigint;
  supplyCirc: bigint;
  supplyMax: bigint;
  regimesSeen: number;
  invariantsHeld: boolean;
  /** m at the close of each epoch. Small, and it is what makes the shape of a
   *  run legible rather than just its endpoint. */
  mTrajectory: number[];
  /** m reached its floor and never came back up at all. */
  floorAbsorbing: boolean;
  /** m at the end of the run is at its floor. */
  endedAtFloor: boolean;
  /** Mean m across closed epochs — the shape of the run in one number. */
  meanM: number;
  /**
   * How far through the launch-to-floor range the run settled, on average.
   * 0 = issuance held at its launch level, 1 = it ran at the floor throughout,
   * negative = it ran above launch (expansion doing its job).
   *
   * This is the reading the verdicts use, in preference to "share of time at
   * the floor" or "ended at the floor". Both of those were tried first and
   * both were bad: the share reading needed an arbitrary cutoff, and the
   * ended-at reading turned on a single epoch, so it missed configurations
   * that spent the whole run near the floor and happened to tick up at the
   * end. Depth is scale-relative and depends on the whole trajectory.
   */
  mDepth: number;
}

/** A structural failure. Ordered most to least severe when reported. */
export type Verdict =
  | "invariant_break"
  | "budget_exhausted"
  | "cut_never_bit"
  | "issuance_dead"
  | "issuance_pinned"
  | "pol_stalled"
  | "policy_inert";

/** Most to least severe. The first entry a cell has is its headline. */
export const VERDICT_ORDER: Verdict[] = [
  "invariant_break",
  "budget_exhausted",
  "cut_never_bit",
  "issuance_dead",
  "issuance_pinned",
  "pol_stalled",
  "policy_inert",
];

export const VERDICT_MEANING: Record<Verdict, string> = {
  invariant_break: "An accounting invariant failed. Everything else this cell reports is suspect.",
  budget_exhausted:
    "The 900M issuance budget was consumed inside the horizon; all later issuance is zero.",
  cut_never_bit:
    "Flow reversed and m did not come down — the contraction response is too weak to matter.",
  issuance_dead:
    "Issuance ran at the floor in a market that gave it no reason to — branches effectively stopped being paid.",
  issuance_pinned: "m sat at its ceiling for most of the run, in a market that should not pin it.",
  pol_stalled: "Fees flowed but protocol-owned liquidity never formed.",
  policy_inert: "The regime never changed in a market that should have flipped it.",
};

export interface Cell {
  /** The parameter overrides that produced this cell. */
  overrides: Partial<Record<keyof Params, number>>;
  /** How many seeds this cell was run with. */
  runs: number;
  /** Fraction of seeds in which each verdict fired. */
  verdictRates: Partial<Record<Verdict, number>>;
  /**
   * Verdicts that fired in a majority of seeds. One seed is an anecdote: the
   * first version of this module ran a single seed per cell and reported a
   * ratchet that disappeared on three seeds out of five. A verdict here means
   * the configuration fails *reliably*, not that it failed once.
   */
  verdicts: Verdict[];
  healthy: boolean;
  /** Metrics from the first seed, for plotting a representative run. */
  sample: CellMetrics;
  /** Mean of m across every seed — the cell in one number. */
  meanM: number;
}

export interface SweepConfig {
  base: Params;
  /** Parameter name to the values to try. Two axes produce a grid. */
  axes: { param: keyof Params; values: number[] }[];
  workload: Workload;
  /** Simulated days per cell. */
  horizonDays: number;
  seed: number;
  /** Genesis charters seeded into every cell. */
  charters?: number;
  /** Seeds per cell. More seeds, less anecdote. Default 5. */
  seeds?: number;
  /** Called after each cell. A full grid takes seconds, so any caller with a
   *  UI needs to be able to say how far along it is. */
  onProgress?: (done: number, total: number) => void;
}

export interface SweepResult {
  config: {
    axes: SweepConfig["axes"];
    horizonDays: number;
    seed: number;
    charters: number;
    seeds: number;
    workload: string;
  };
  cells: Cell[];
  healthyCount: number;
  skipped: number;
}

/** Run one world for the horizon and report what became of it. */
export function runCell(
  params: Params,
  workload: Workload,
  horizonDays: number,
  seed: number,
  charters: number,
): { metrics: CellMetrics; verdicts: Verdict[] } {
  const rng = makeRng(seed);
  const day = workload.make();
  let world = createWorld(params, 0);
  world = seedGenesis(world, charters);

  let atFloor = 0;
  let atCeiling = 0;
  let closes = 0;
  let invariantsHeld = true;
  const regimes = new Set<string>();
  const mTrajectory: number[] = [];
  let lastEpoch = world.epoch;

  for (let d = 0; d < horizonDays; d++) {
    world = day(world, d, rng);
    if (!world.invariantsOk) invariantsHeld = false;
    world = tick(world, DAY_SECONDS);
    if (!world.invariantsOk) invariantsHeld = false;

    // Sample m per *closed epoch*, not per day: m only moves at epoch close,
    // so sampling daily would just weight the result by epoch length.
    if (world.epoch > lastEpoch) {
      for (let e = lastEpoch; e < world.epoch; e++) {
        closes += 1;
        if (world.m <= params.mMin + 1e-9) atFloor += 1;
        if (world.m >= params.mMax - 1e-9) atCeiling += 1;
        mTrajectory.push(world.m);
      }
      lastEpoch = world.epoch;
      const F = world.F.at(-1) ?? 0n;
      regimes.add(F > 0n ? "expansion" : "contraction");
    }
  }

  // Absorbing iff m is at the floor at the end and never rose after the first
  // time it got there.
  const firstFloor = mTrajectory.findIndex((m) => m <= params.mMin + 1e-9);
  const floorAbsorbing =
    firstFloor >= 0 && mTrajectory.slice(firstFloor).every((m) => m <= params.mMin + 1e-9);

  const endedAtFloor =
    mTrajectory.length > 0 && mTrajectory[mTrajectory.length - 1] <= params.mMin + 1e-9;
  const meanM = mTrajectory.length
    ? mTrajectory.reduce((a, b) => a + b, 0) / mTrajectory.length
    : params.mLaunch;
  const range = params.mLaunch - params.mMin;
  const mDepth = range > 0 ? (params.mLaunch - meanM) / range : 0;

  const metrics: CellMetrics = {
    timeAtFloor: closes > 0 ? atFloor / closes : 0,
    timeAtCeiling: closes > 0 ? atCeiling / closes : 0,
    mFinal: world.m,
    epochsClosed: closes,
    budgetUsed: Number(world.issuanceCreditsCum) / Number(ISSUANCE_BUDGET),
    polEth: world.polEth,
    supplyCirc: supplyCirc(world),
    supplyMax: supplyMax(world),
    regimesSeen: regimes.size,
    invariantsHeld,
    mTrajectory,
    floorAbsorbing,
    endedAtFloor,
    meanM,
    mDepth,
  };

  // Verdicts are judged against what this market *should* produce. Rails are
  // not failures in themselves: m riding the ceiling under sustained inflow is
  // the policy working, and m at the floor after a sustained outflow is too.
  // The same readings in the wrong market are what matter.
  const RAIL = 0.8; // four fifths of a run against a rail is not regulation
  const DEAD_DEPTH = 0.75; // see mDepth
  const BITE_DEPTH = 0.1; // below this, a reversal moved issuance essentially not at all
  const want = workload.expect;
  const verdicts: Verdict[] = [];

  if (!invariantsHeld) verdicts.push("invariant_break");
  if (world.issuanceCreditsCum >= ISSUANCE_BUDGET) verdicts.push("budget_exhausted");

  // The headline question for a reversal market: did the cut actually bite?
  // Measured as depth, not as time at the ceiling -- the ceiling reading only
  // catches this when m happened to start pinned there, and misses a cut so
  // weak that m simply drifts in the middle of its range forever.
  if (want.m === "falls" && closes > 0 && metrics.mDepth < BITE_DEPTH)
    verdicts.push("cut_never_bit");

  // Issuance ran essentially at the floor in a market that gave it no reason
  // to. DEAD_DEPTH is 0.75 because the observed separation is not close: in a
  // directionless market, cutStep <= raiseStep settles at depth 0.03-0.08 and
  // anything above it settles at 0.73-0.95. The threshold sits in an empty
  // gap rather than slicing through a cluster.
  if (want.m !== "falls" && metrics.mDepth >= DEAD_DEPTH) verdicts.push("issuance_dead");
  if (want.m !== "rises" && closes > 0 && metrics.timeAtCeiling >= RAIL && want.m !== "falls")
    verdicts.push("issuance_pinned");

  if (world.feeBucketEth === 0n && world.polEth === 0n && closes > 0) verdicts.push("pol_stalled");
  if (want.regimeChanges && regimes.size < 2 && closes > 1) verdicts.push("policy_inert");

  return { metrics, verdicts };
}

/** Cartesian product of the axes: every combination of parameter values. */
function grid(axes: SweepConfig["axes"]): Partial<Record<keyof Params, number>>[] {
  return axes.reduce<Partial<Record<keyof Params, number>>[]>(
    (acc, axis) => acc.flatMap((row) => axis.values.map((v) => ({ ...row, [axis.param]: v }))),
    [{}],
  );
}

export function runSweep(config: SweepConfig): SweepResult {
  const charters = config.charters ?? 5;
  const seeds = config.seeds ?? 5;
  const cells: Cell[] = [];
  let skipped = 0;
  const combos = grid(config.axes);
  let done = 0;

  for (const overrides of combos) {
    const params = { ...config.base, ...overrides } as Params;

    // mLaunch is a starting condition, not the variable under test. Sweeping
    // mMax down to 0.5 with the default mLaunch of 1.0 would put every one of
    // those cells outside its own range and blank the whole row -- the first
    // run of this reported "10 invalid combinations skipped" and two empty
    // rows, which says nothing about the policy. A real deployment picking a
    // lower ceiling would pick a launch value inside it, so clamp.
    if (overrides.mLaunch === undefined) {
      params.mLaunch = Math.min(Math.max(params.mLaunch, params.mMin), params.mMax);
    }

    // A combination the schema would genuinely reject is a different matter:
    // that is an invalid configuration, not a finding about the policy.
    if (params.mMin > params.mMax || params.feeFloor > params.feeCeil) {
      skipped += 1;
      continue;
    }

    // Run the same cell across several seeds and keep the rate, not the
    // outcome. A verdict that fires on 1 seed in 5 is noise; one that fires on
    // 5 in 5 is a property of the configuration.
    const runs = Array.from({ length: seeds }, (_, i) =>
      runCell(params, config.workload, config.horizonDays, config.seed + i, charters),
    );
    const counts = new Map<Verdict, number>();
    for (const r of runs) for (const v of r.verdicts) counts.set(v, (counts.get(v) ?? 0) + 1);

    const verdictRates: Partial<Record<Verdict, number>> = {};
    for (const [v, n] of counts) verdictRates[v] = n / seeds;
    const verdicts = VERDICT_ORDER.filter((v) => (verdictRates[v] ?? 0) > 0.5);

    cells.push({
      overrides,
      runs: seeds,
      verdictRates,
      verdicts,
      healthy: verdicts.length === 0,
      sample: runs[0].metrics,
      meanM: runs.reduce((a, r) => a + r.metrics.meanM, 0) / seeds,
    });
    config.onProgress?.((done += 1), combos.length);
  }

  return {
    config: {
      axes: config.axes,
      horizonDays: config.horizonDays,
      seed: config.seed,
      charters,
      seeds,
      workload: config.workload.name,
    },
    cells,
    healthyCount: cells.filter((c) => c.healthy).length,
    skipped,
  };
}
