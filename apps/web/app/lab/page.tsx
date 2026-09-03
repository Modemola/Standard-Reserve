"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_PARAMS,
  ISSUANCE_BUDGET,
  applySwap,
  buyCharter,
  createWorld,
  invariantCheck,
  quoteCharterPrice,
  reportDormant,
  seedGenesis,
  spotPriceEthPerStd,
  supplyCirc,
  supplyMax,
  tick,
} from "@standard-law/engine";
import { Charts } from "@/components/Charts";
import { ConstantsDrawer } from "@/components/ConstantsDrawer";
import { RegimeBadge } from "@/components/RegimeBadge";
import { fmtDuration, fmtEth, fmtToken, fmtWad } from "@/lib/format";
import { useEpochHistory, useSimStore, useWorld } from "@/lib/sim-context";
import { SCENARIO_IDS, fetchScenario } from "@/lib/scenarios";
import type { Scenario } from "@standard-law/engine";

export default function LabPage() {
  return (
    <Suspense fallback={null}>
      <LabInner />
    </Suspense>
  );
}

function LabInner() {
  const store = useSimStore();
  const world = useWorld();
  const history = useEpochHistory();
  const searchParams = useSearchParams();

  const [buyEthAmount, setBuyEthAmount] = useState("1");
  const [sellStdAmount, setSellStdAmount] = useState("1000");
  const [showConstants, setShowConstants] = useState(false);
  const [seedCount, setSeedCount] = useState("10");
  const [charterOwnerKey, setCharterOwnerKey] = useState("");
  const [dormantCharterId, setDormantCharterId] = useState("c-0042");
  const [dormantReporterKey, setDormantReporterKey] = useState("reporter-1");
  const [dailyCap, setDailyCap] = useState(String(world.params.charterDailyCap));
  const [scenarioId, setScenarioId] = useState<string>(SCENARIO_IDS[0]);

  async function loadScenarioById(id: string) {
    try {
      const scenario = (await fetchScenario(id)) as Scenario;
      store.loadScenario(scenario, world.params);
    } catch {
      // fetchScenario throws on a non-OK response; a malformed-JSON parse
      // failure lands here too. Surface it through the same lastError ->
      // ErrorToast path every other rejected action already uses, rather
      // than failing silently.
      store.apply((w) => ({ ...w, lastError: "scenario_load_failed" }));
    }
  }

  useEffect(() => {
    const fromUrl = searchParams.get("scenario");
    if (fromUrl && SCENARIO_IDS.includes(fromUrl as (typeof SCENARIO_IDS)[number])) {
      setScenarioId(fromUrl);
      void loadScenarioById(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function exportWorld() {
    const blob = new Blob([store.export()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `world-epoch-${world.epoch}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const regime = world.F.length > 0 && world.F[world.F.length - 1] > 0n ? "expansion" : "contraction";
  const signal =
    (world.F.length >= 1 ? world.F[world.F.length - 1] : 0n) +
    (world.F.length >= 2 ? world.F[world.F.length - 2] : 0n);
  const inv = invariantCheck(world);
  const epochElapsed = world.now - world.epochStartedAt;
  const epochRemaining = Math.max(world.params.epochSeconds - epochElapsed, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="space-y-4 lg:col-span-7">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">epoch {world.epoch}</p>
              <p className="text-xs text-white/40">{fmtDuration(epochRemaining)} remaining</p>
            </div>
            <RegimeBadge regime={regime} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Stat label="F_n (last epoch)" value={fmtEth(world.F.at(-1) ?? 0n)} />
            <Stat label="signal" value={fmtEth(signal)} />
            <Stat label="m" value={world.m.toFixed(2)} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Supply</h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="S_circ" value={fmtToken(supplyCirc(world))} />
            <div data-testid="s-max">
              <Stat label="S_max" value={fmtToken(supplyMax(world))} />
            </div>
            <Stat label="M (minted)" value={fmtToken(world.M)} />
            <Stat label="B (burned)" value={fmtToken(world.B)} />
          </div>
          <p className="mt-2 text-xs text-white/40">
            issuance credits {fmtToken(world.issuanceCreditsCum)} / {fmtToken(ISSUANCE_BUDGET)}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Vaults &amp; POL</h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat label="expansion ETH" value={fmtEth(world.vaults.expansionEth)} />
            <Stat label="expansion gold" value={fmtWad(world.vaults.expansionGold, 3)} />
            <Stat label="contraction ETH" value={fmtEth(world.vaults.contractionEth)} />
            <Stat label="POL ETH" value={fmtEth(world.polEth)} />
            <Stat label="POL STD" value={fmtToken(world.polStd)} />
            <Stat label="pool spot" value={`${spotPriceEthPerStd(world.pool).toFixed(8)} ETH/STD`} />
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-label={inv.ok ? "invariants OK" : `invariants FAIL: ${inv.failures.join(", ")}`}
          className={`rounded-lg border p-4 text-sm ${
            inv.ok ? "border-expansion/30 bg-expansion/5 text-expansion" : "border-contraction/40 bg-contraction/10 text-contraction"
          }`}
        >
          <p className="font-mono uppercase tracking-widest">{inv.ok ? "invariants OK" : "invariants FAIL"}</p>
          {!inv.ok && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {inv.failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4 lg:col-span-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h3 className="text-sm font-medium text-white/70">Injectors</h3>

          <div className="flex gap-2">
            <input
              value={buyEthAmount}
              onChange={(e) => setBuyEthAmount(e.target.value)}
              aria-label="ETH to spend buying STD"
              placeholder="ETH"
              inputMode="decimal"
              className="w-24 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <button
              onClick={() => store.apply((w) => applySwap(w, "buyStd", parseAmount(buyEthAmount)))}
              className="flex-1 rounded border border-expansion/40 bg-expansion/10 px-2 py-1 text-xs text-expansion"
            >
              buy STD (ETH)
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={sellStdAmount}
              onChange={(e) => setSellStdAmount(e.target.value)}
              aria-label="STD to sell"
              placeholder="STD"
              inputMode="decimal"
              className="w-24 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <button
              onClick={() => store.apply((w) => applySwap(w, "sellStd", parseAmount(sellStdAmount)))}
              className="flex-1 rounded border border-contraction/40 bg-contraction/10 px-2 py-1 text-xs text-contraction"
            >
              sell STD
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => store.apply((w) => tick(w, 3600))}
              className="flex-1 rounded border border-white/15 py-1 text-xs"
            >
              +1h
            </button>
            <button
              onClick={() => store.apply((w) => tick(w, w.params.epochSeconds))}
              className="flex-1 rounded border border-white/15 py-1 text-xs"
            >
              +1 epoch
            </button>
            <button
              onClick={() => store.apply((w) => tick(w, 86400))}
              className="flex-1 rounded border border-white/15 py-1 text-xs"
            >
              +1 day
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={seedCount}
              onChange={(e) => setSeedCount(e.target.value)}
              aria-label="Number of genesis charters to spawn"
              inputMode="numeric"
              className="w-20 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <button
              onClick={() => store.apply((w) => seedGenesis(w, Number(seedCount) || 0))}
              className="flex-1 rounded border border-white/15 py-1 text-xs"
            >
              spawn genesis charters
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
              aria-label="New charterDailyCap value"
              inputMode="numeric"
              className="w-20 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <button
              onClick={() =>
                store.apply((w) => ({
                  ...w,
                  params: { ...w.params, charterDailyCap: Number(dailyCap) || 0 },
                  charterAuction: { ...w.charterAuction, cap: Number(dailyCap) || 0 },
                }))
              }
              className="flex-1 rounded border border-white/15 py-1 text-xs"
            >
              force charterDailyCap
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={charterOwnerKey}
              onChange={(e) => setCharterOwnerKey(e.target.value)}
              aria-label="New charter owner key"
              placeholder="owner key"
              className="w-24 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <button
              onClick={() =>
                store.apply((w) =>
                  buyCharter(w, charterOwnerKey || `owner-${w.now}-${w.day}`, quoteCharterPrice(w)),
                )
              }
              disabled={world.params.charterDailyCap <= 0}
              className="flex-1 rounded border border-white/15 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              buy charter ({fmtEth(quoteCharterPrice(world))} ETH)
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={dormantCharterId}
              onChange={(e) => setDormantCharterId(e.target.value)}
              aria-label="Charter id to report dormant"
              placeholder="charter id"
              className="w-20 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <input
              value={dormantReporterKey}
              onChange={(e) => setDormantReporterKey(e.target.value)}
              aria-label="Reporter key"
              placeholder="reporter"
              className="w-20 rounded border border-white/15 bg-transparent px-2 py-1 text-sm"
            />
            <button
              onClick={() =>
                store.apply((w) => reportDormant(w, dormantCharterId, dormantReporterKey || "reporter"))
              }
              className="flex-1 rounded border border-white/15 py-1 text-xs"
            >
              report dormant
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="flex-1 rounded border border-white/15 bg-ink px-2 py-1 text-xs"
            >
              {SCENARIO_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadScenarioById(scenarioId)}
              className="rounded border border-white/15 px-3 py-1 text-xs"
            >
              load scenario
            </button>
          </div>

          <button onClick={exportWorld} className="w-full rounded border border-white/15 py-1.5 text-xs">
            export world JSON
          </button>

          <button
            onClick={() => store.apply(() => createWorld(DEFAULT_PARAMS, 0))}
            className="w-full rounded border border-contraction/40 py-1.5 text-xs text-contraction"
          >
            reset world
          </button>

          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={() => store.apply((w) => ({ ...w, polEth: -1n }))}
              title="Dev-only: directly corrupts polEth to demo the invariant pill failing. Not a legal action — reset world to recover."
              className="w-full rounded border border-dashed border-contraction/60 py-1.5 text-xs text-contraction/80"
            >
              debug: break POL (dev only)
            </button>
          )}
        </div>

        <button
          onClick={() => setShowConstants((v) => !v)}
          aria-expanded={showConstants}
          className="w-full rounded border border-white/15 py-1.5 text-xs text-white/70"
        >
          {showConstants ? "hide constants (params.json)" : "show constants (params.json)"}
        </button>
        {showConstants && <ConstantsDrawer params={world.params} />}
      </section>

      <section className="lg:col-span-12">
        <Charts history={history} />
      </section>
    </div>
  );
}

/** Parses a decimal string to a WAD (1e18) bigint. Used for both ETH and
 * STD amounts, which share the same fixed-point scale. */
function parseAmount(v: string): bigint {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e18));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-white/40">{label}</p>
      <p className="tabular font-mono text-white/85">{value}</p>
    </div>
  );
}
