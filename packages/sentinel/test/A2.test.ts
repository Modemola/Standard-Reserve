import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  applySwap,
  createWorld,
  seedGenesis,
  tick,
} from "@standard-law/engine";
import { loadFixtures } from "../src/runAll.js";
import { runAttack } from "../src/runAttack.js";

const fixture = () => loadFixtures().find((f) => f.id === "A2_one_block_pump")!;

/** Two quiet epochs, then optionally a giant buy in the final minute, then the close. */
function runPumpScenario(withPump: boolean) {
  let w = seedGenesis(createWorld(DEFAULT_PARAMS, 0), 50);
  w = tick(w, 2 * DEFAULT_PARAMS.epochSeconds); // epochs 0 and 1 close at F = 0
  w = tick(w, DEFAULT_PARAMS.epochSeconds - 60);
  const mBeforeClose = w.m;
  if (withPump) w = applySwap(w, "buyStd", 50n * 10n ** 18n);
  w = tick(w, 60); // ring the bell
  return { m: w.m, mBeforeClose, F: w.F };
}

describe("A2 one-block pump", () => {
  it("holds: the pump cannot buy a raise", () => {
    const v = runAttack(fixture());
    expect(v.status, JSON.stringify([...v.broken, ...v.unexpected])).toBe("held");
  });

  it("the pump does flip the epoch to expansion — it is a real, large buy", () => {
    const v = runAttack(fixture());
    expect(v.after.regime).toBe("expansion");
    const pump = v.tape.find((r) => r.op === "buyStd");
    expect(BigInt(pump?.ethIn ?? "0")).toBe(50n * 10n ** 18n);
  });

  it("issuance reads the two previous closed epochs, not the one being pumped", () => {
    const pumped = runPumpScenario(true);
    const control = runPumpScenario(false);

    // The pumped epoch closes strongly positive...
    expect(pumped.F[pumped.F.length - 1] > 0n).toBe(true);
    // ...yet m does not rise above where it already stood before the close.
    expect(pumped.m).toBeLessThanOrEqual(pumped.mBeforeClose);
    // The only thing the pump bought was skipping one cut, never a raise.
    expect(control.m).toBeLessThan(pumped.m);
    expect(pumped.m).toBe(pumped.mBeforeClose);
  });
});
