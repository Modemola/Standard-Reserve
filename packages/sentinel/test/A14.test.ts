// A14's finding is a negative: a ten-fold move in `ethPerGoldGram` changes
// nothing, because v1's expansion vault holds ETH and never converts. A note
// saying so decays the moment somebody wires the conversion, and nothing would
// notice. The fixture used to say `vaultGoldMustNotDecrease`, which could not
// catch it either -- a balance that is always zero can never fall -- and now
// says `vaultGoldUnchanged`, which can.
//
// So assert the claim as stated, and the point is that this is *supposed* to
// go red one day.
//
// One wrinkle: `hashWorld` hashes params alongside state, deliberately, so
// that scenario replay notices a parameter edit. That is right for its job and
// wrong for this question -- it makes any overlay change the hash whether or
// not a balance moved. The params are therefore substituted back before
// comparing, which leaves every state field the engine hashes still in play.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAW_PARAMS,
  applySwap,
  createWorld,
  hashWorld,
  loadParamsWithOverlay,
  seedGenesis,
  tick,
} from "@standard-law/engine";
import type { Params, RawParams, World } from "@standard-law/engine";

/** A14's own action sequence: two expansion closes, which fund the vault. */
function run(overlay: Partial<RawParams>): World {
  const params: Params = loadParamsWithOverlay(DEFAULT_RAW_PARAMS, overlay);
  let w = seedGenesis(createWorld(params, 0), 20);
  for (let i = 0; i < 2; i++) {
    w = applySwap(w, "buyStd", 15_000000000000000000n);
    w = tick(w, params.epochSeconds);
  }
  return w;
}

/** Everything the engine hashes except the parameters themselves. */
function stateHash(w: World, params: Params): string {
  return hashWorld({ ...w, params });
}

const TEN_FOLD = { ethPerGoldGram: "2000000000000000000" };

describe("A14 — the gold oracle is declared, not wired", () => {
  it("a ten-fold move in the oracle changes no state at all", () => {
    const plain = run({});
    const moved = run(TEN_FOLD);

    // Not "gold did not fall" -- no balance moved anywhere, by any path.
    expect(stateHash(moved, plain.params)).toBe(stateHash(plain, plain.params));
  });

  it("and the comparison is live: a parameter that *is* consumed diverges", () => {
    // Positive control. Without it the assertion above would pass for any two
    // worlds whose difference the state hash cannot see, including none.
    const plain = run({});
    const dearer = run({ poolFeeBps: 100 });
    expect(stateHash(dearer, plain.params)).not.toBe(stateHash(plain, plain.params));
  });

  it("gold is exactly zero throughout, not merely non-decreasing", () => {
    const params = loadParamsWithOverlay(DEFAULT_RAW_PARAMS, TEN_FOLD);
    let w = seedGenesis(createWorld(params, 0), 20);
    expect(w.vaults.expansionGold).toBe(0n);
    for (let i = 0; i < 2; i++) {
      w = applySwap(w, "buyStd", 15_000000000000000000n);
      expect(w.vaults.expansionGold).toBe(0n);
      w = tick(w, params.epochSeconds);
      expect(w.vaults.expansionGold).toBe(0n);
    }
    // The epochs really did fund a vault -- so the zero above is a statement
    // about gold, not about a world where nothing happened.
    expect(w.vaults.expansionEth).toBeGreaterThan(0n);
  });
});
