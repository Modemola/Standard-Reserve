"use client";

import { useMemo, useState } from "react";
import { applySwap } from "@standard-law/engine";
import { charterBoard, exitImpact, flipQuote, licensePlans, poolPrints } from "@standard-law/desk";
import { CharterTombstone } from "@/components/CharterTombstone";
import { ExitTape } from "@/components/ExitTape";
import { FlipWidget } from "@/components/FlipWidget";
import { LicenseSolver } from "@/components/LicenseSolver";
import { TapeTable } from "@/components/TapeTable";
import { DEMO_CHARTER_ID } from "@/lib/demo-seed";
import { useSimStore, useTape, useWorld } from "@/lib/sim-context";

const WAD = 10n ** 18n;

export default function DeskPage() {
  const store = useSimStore();
  const world = useWorld();
  const tape = useTape();

  const [swapAmount, setSwapAmount] = useState("1");
  const [extraLedger, setExtraLedger] = useState(0);
  const [crowd, setCrowd] = useState(0);

  const charterId = world.charters[DEMO_CHARTER_ID] ? DEMO_CHARTER_ID : Object.keys(world.charters)[0];

  const flip = useMemo(() => flipQuote(world), [world]);
  const board = useMemo(() => charterBoard(world), [world]);
  const plans = useMemo(
    () => (charterId ? licensePlans(world, charterId) : []),
    [world, charterId],
  );
  const prints = useMemo(() => poolPrints(tape), [tape]);

  const impact = useMemo(() => {
    if (!charterId) return null;
    const branch = world.charters[charterId]?.branches.find((b) => b.alive);
    if (!branch) return null;
    return exitImpact(world, charterId, branch.id, crowd, BigInt(extraLedger) * WAD || undefined);
  }, [world, charterId, crowd, extraLedger]);

  function commitSwap(side: "buyStd" | "sellStd") {
    const n = Number(swapAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    const amount = BigInt(Math.round(n * 1e18));
    store.apply((w) => applySwap(w, side, amount), side);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Open Market Desk</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/60">
          Prices for the only legal moves the bank has: flip the epoch&rsquo;s sign, take a licence
          now or wait for the decay, or pay the run tax and leave. Quotes are solved on clones of
          the live world.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <FlipWidget quote={flip} />

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-widest text-white/50">
                Pool tape
              </h3>
              <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] tracking-widest text-white/40">
                SIM
              </span>
            </div>
            <TapeTable
              rows={prints}
              emptyNote="No prints this session — inject a swap in the Lab, or commit one below."
            />
            <div className="mt-3 flex gap-2">
              <input
                aria-label="swap amount in ETH"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                className="w-24 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
              />
              <button
                onClick={() => commitSwap("buyStd")}
                data-testid="desk-commit-buy"
                className="flex-1 rounded border border-expansion/40 bg-expansion/10 px-2 py-1 text-xs text-expansion"
              >
                Commit buy (ETH in)
              </button>
              <button
                onClick={() => commitSwap("sellStd")}
                className="flex-1 rounded border border-contraction/40 bg-contraction/10 px-2 py-1 text-xs text-contraction"
              >
                Commit sell (STD in)
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/35">
              Commit writes to the live simulation, exactly like the Lab injectors.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {charterId ? (
            <LicenseSolver rows={plans} charterId={charterId} />
          ) : (
            <p className="rounded-lg border border-white/10 p-4 text-sm text-white/40">
              No live charter in this world.
            </p>
          )}

          <ExitTape
            impact={impact}
            extraLedger={extraLedger}
            onExtraLedger={setExtraLedger}
            crowd={crowd}
            onCrowd={setCrowd}
          />

          <CharterTombstone board={board} />
        </section>
      </div>
    </div>
  );
}
