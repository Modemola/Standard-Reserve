// Adversarial probes — can a rational actor extract value from the policy?
//
// The sweep asks which parameter settings degenerate. This asks a different
// question: holding the parameters at their defaults, is there a *strategy*
// that profits at the protocol's expense? Those are the two halves of "is this
// policy sound", and the second one is where real money goes missing.
//
// Three rules keep the answers honest:
//
//   1. **Every attack runs against a control.** A strategy that ends with more
//      tokens than it started has not necessarily gained anything -- issuance
//      streams to every live branch whether you attack or not. Only the
//      difference from a passive actor doing nothing clever is attributable.
//
//   2. **The harness charges for things the engine does not.** v1 has no
//      wallet (spec §0), so `buyLicense` burns the price into B without
//      debiting anyone. Left uncorrected, "buy a licence, retire it, keep the
//      mint" would read as an infinite-money exploit when it is really an
//      artifact of the simplification. The adversary's own ledger pays the
//      quoted price, so the question stays "is retiring worth more than the
//      licence cost?" -- which is a real question about the protocol.
//
//   3. **A finding is reported in the units it was measured in.** No attack
//      converts $STANDARD to ETH at the pool price to claim a headline profit:
//      the pool is 100 ETH deep against 100M STD, so marking a large token
//      position to spot would invent a number the market could never pay.
import { DAY_SECONDS } from "./constants.js";
import {
  applySwap,
  buyLicense,
  createWorld,
  quoteLicense,
  quoteRetirement,
  reportDormant,
  retireBranch,
  seedGenesis,
  tick,
} from "./store.js";
import type { Params, World } from "./types.js";

/** What an adversary put in and took out, in the units it happened in. */
export interface Ledger {
  /** ETH spent buying $STANDARD. */
  ethSpent: bigint;
  /** ETH received selling $STANDARD. */
  ethReceived: bigint;
  /** $STANDARD the actor was minted (branch retirements). */
  stdMinted: bigint;
  /** $STANDARD notionally paid for licences — the engine does not debit this,
   *  so the harness does, or the result is meaningless. */
  stdPaidForLicences: bigint;
  /** $STANDARD still sitting in the actor's live branch ledgers. */
  stdInBranches: bigint;
}

function emptyLedger(): Ledger {
  return {
    ethSpent: 0n,
    ethReceived: 0n,
    stdMinted: 0n,
    stdPaidForLicences: 0n,
    stdInBranches: 0n,
  };
}

/** Net position, still in native units — deliberately not collapsed to one number. */
export function netPosition(l: Ledger): { netEth: bigint; netStd: bigint } {
  return {
    netEth: l.ethReceived - l.ethSpent,
    netStd: l.stdMinted + l.stdInBranches - l.stdPaidForLicences,
  };
}

function liveLedgerOf(world: World, charterId: string): bigint {
  const c = world.charters[charterId];
  if (!c || !c.alive) return 0n;
  let total = 0n;
  for (const b of c.branches) if (b.alive) total += b.ledger;
  return total;
}

/** Seed a world with `charters` genesis charters; the first is the actor's. */
function seedWorld(params: Params, charters: number): { world: World; mine: string } {
  let world = createWorld(params, 0);
  world = seedGenesis(world, charters);
  const mine = Object.keys(world.charters)[0];
  return { world, mine };
}

export interface Strategy {
  readonly name: string;
  /** The question this strategy is asking of the policy. */
  readonly question: string;
  /** One day of play. Mutates the ledger to record what the actor paid/received. */
  readonly day: (ctx: {
    world: World;
    mine: string;
    day: number;
    ledger: Ledger;
    params: Params;
  }) => World;
}

/** Buy `eth` worth of $STANDARD, recording the spend. */
function buy(world: World, ledger: Ledger, eth: bigint): World {
  if (eth <= 0n) return world;
  ledger.ethSpent += eth;
  return applySwap(world, "buyStd", eth);
}

/** Sell `std`, recording the ETH received (net of the pool fee). */
function sell(world: World, ledger: Ledger, std: bigint): World {
  if (std <= 0n) return world;
  const before = world.pool.eth;
  const after = applySwap(world, "sellStd", std);
  // ethOut is whatever left the pool minus the fee that stayed behind; the
  // reserve delta is exactly what the trader could have received.
  ledger.ethReceived += before - after.pool.eth;
  return after;
}

export const STRATEGIES: Record<string, Strategy> = {
  /**
   * Passive control. Holds its genesis branch and does nothing clever, so every
   * other strategy's numbers are read as a difference from this.
   */
  passive: {
    name: "passive",
    question: "What does an actor earn for simply existing? Every other result is measured against this.",
    day: ({ world }) => world,
  },

  /**
   * Buy the signal up, harvest issuance at the elevated multiplier, then leave.
   *
   * This is the central economic attack on any flow-driven policy: m rises on
   * sustained inflow, issuance streams to live branches while it is high, and
   * the question is whether the tokens harvested are worth more than the price
   * impact and fees paid to manufacture the inflow.
   */
  pump_and_harvest: {
    name: "pump_and_harvest",
    question: "Can buying to inflate m, harvesting issuance, then exiting, come out ahead of the cost of the pump?",
    day: ({ world, ledger, day }) => {
      const PUMP_DAYS = 40;
      if (day < PUMP_DAYS) return buy(world, ledger, 2n * 10n ** 18n);
      return world; // stop pumping; the exit is settled once at the end
    },
  },

  /**
   * Open a branch, let it accrue, retire it, repeat.
   *
   * Retiring mints the branch ledger to the holder less the resolution fee,
   * and rebates half that fee to sibling branches. The harness pays the quoted
   * licence price, so this asks whether the churn is worth its own cost rather
   * than exploiting the missing wallet.
   */
  licence_churn: {
    name: "licence_churn",
    question: "Is buy-licence -> accrue -> retire a profitable cycle once the licence is actually paid for?",
    day: ({ world, mine, ledger, day }) => {
      let w = world;
      const charter = w.charters[mine];
      if (!charter?.alive) return w;

      // Retire anything that has accrued for a while, then refill the slot.
      if (day % 7 === 6) {
        for (const b of charter.branches.filter((x) => x.alive)) {
          if (charter.branches.filter((x) => x.alive).length <= 1) break;
          const quote = quoteRetirement(w, mine, b.id);
          if (!quote) continue;
          const next = retireBranch(w, mine, b.id);
          if (!next.lastError) {
            ledger.stdMinted += quote.mintToUser;
            w = next;
          }
        }
      }
      const price = quoteLicense(w).pNow;
      const next = buyLicense(w, mine);
      if (!next.lastError) {
        ledger.stdPaidForLicences += price;
        w = next;
      }
      return w;
    },
  },

  /**
   * Let your own charter go dormant, then report it yourself.
   *
   * `reportDormant` takes a reporter key but never checks it is not the owner,
   * so nothing stops an owner collecting their own bounty. The question is
   * whether the bounty is worth more than the revocation it triggers.
   */
  self_report_dormancy: {
    name: "self_report_dormancy",
    question: "Does reporting your own dormant charter pay more than the revocation costs you?",
    day: ({ world, mine, ledger, day, params }) => {
      const dormantAfterDays = Math.ceil(params.dormancySeconds / DAY_SECONDS);
      if (day !== dormantAfterDays + 1) return world;

      // The bounty is measured as the change in M across the call, not
      // re-derived from the bps formula. Re-deriving would make this harness
      // agree with the engine by construction even if the engine were wrong,
      // which is the opposite of what an adversarial probe is for. The first
      // version of this strategy simply forgot to credit the bounty at all,
      // and so "reporting yourself does not pay" rested on not having counted
      // the payment.
      const before = world.M;
      const after = reportDormant(world, mine, "self");
      if (after.lastError) return after;
      ledger.stdMinted += after.M - before;
      // Revocation zeroes every branch: the position is gone, not banked.
      ledger.stdInBranches = 0n;
      return after;
    },
  },
};

export interface AttackResult {
  strategy: string;
  question: string;
  days: number;
  ledger: Ledger;
  netEth: bigint;
  netStd: bigint;
  /** The same figures for the passive control over the same world and seed. */
  controlNetStd: bigint;
  controlNetEth: bigint;
  /** What the strategy gained *over doing nothing*. This is the finding. */
  edgeStd: bigint;
  edgeEth: bigint;
  /**
   * Peak and mean m over the run, not just the final value. A pump that lifts
   * m to its ceiling for forty days and then stops ends at the floor like
   * everyone else -- reporting only the final value hid the entire effect the
   * strategy was built to produce.
   */
  peakM: number;
  meanM: number;
  controlPeakM: number;
  controlMeanM: number;
}

/** Play one strategy for `days`, then settle: sell nothing, just count. */
function play(params: Params, strategy: Strategy, days: number, charters: number): {
  ledger: Ledger;
  peakM: number;
  meanM: number;
} {
  const { world: seeded, mine } = seedWorld(params, charters);
  let world = seeded;
  const ledger = emptyLedger();
  const mSamples: number[] = [];

  for (let day = 0; day < days; day++) {
    world = strategy.day({ world, mine, day, ledger, params });
    world = tick(world, DAY_SECONDS);
    mSamples.push(world.m);
  }

  // Exit: whatever the pump bought is sold back at the end, so the price
  // impact of leaving is paid for rather than ignored.
  if (strategy.name === "pump_and_harvest") {
    // The actor's $STANDARD position is what it bought; approximate it by
    // selling back an amount equal to the ETH it spent, at the current pool.
    const owed = ledger.ethSpent;
    if (owed > 0n) {
      const stdForEth = (world.pool.std * owed) / (world.pool.eth + owed);
      world = sell(world, ledger, stdForEth);
    }
  }

  ledger.stdInBranches = liveLedgerOf(world, mine);
  return {
    ledger,
    peakM: mSamples.length ? Math.max(...mSamples) : params.mLaunch,
    meanM: mSamples.length ? mSamples.reduce((a, b) => a + b, 0) / mSamples.length : params.mLaunch,
  };
}

export function runAttack(
  params: Params,
  strategyName: string,
  days: number,
  charters = 5,
): AttackResult {
  const strategy = STRATEGIES[strategyName];
  if (!strategy) throw new Error(`unknown strategy: ${strategyName}`);

  const attack = play(params, strategy, days, charters);
  const control = play(params, STRATEGIES.passive, days, charters);

  const a = netPosition(attack.ledger);
  const c = netPosition(control.ledger);

  return {
    strategy: strategy.name,
    question: strategy.question,
    days,
    ledger: attack.ledger,
    netEth: a.netEth,
    netStd: a.netStd,
    controlNetEth: c.netEth,
    controlNetStd: c.netStd,
    edgeStd: a.netStd - c.netStd,
    edgeEth: a.netEth - c.netEth,
    peakM: attack.peakM,
    meanM: attack.meanM,
    controlPeakM: control.peakM,
    controlMeanM: control.meanM,
  };
}
