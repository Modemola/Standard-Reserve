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
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Download,
  Flag,
  Landmark,
  Play,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card } from "@/components/Card";
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
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-white/40">
                epoch {world.epoch}
              </p>
              <p className="mt-0.5 text-xs text-white/40">{fmtDuration(epochRemaining)} remaining</p>
            </div>
            <RegimeBadge regime={regime} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4 text-sm">
            <Stat label="F_n (last epoch)" value={fmtEth(world.F.at(-1) ?? 0n)} />
            <Stat label="signal" value={fmtEth(signal)} />
            <Stat label="m" value={world.m.toFixed(2)} />
          </div>
        </Card>

        <Card>
          <SectionTitle>Supply</SectionTitle>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="S_circ" value={fmtToken(supplyCirc(world))} />
            <div data-testid="s-max">
              <Stat label="S_max" value={fmtToken(supplyMax(world))} />
            </div>
            <Stat label="M (minted)" value={fmtToken(world.M)} />
            <Stat label="B (burned)" value={fmtToken(world.B)} />
          </div>
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-white/40">
            issuance credits{" "}
            <span className="tabular font-mono text-white/60">
              {fmtToken(world.issuanceCreditsCum)} / {fmtToken(ISSUANCE_BUDGET)}
            </span>
          </p>
        </Card>

        <Card>
          <SectionTitle>Vaults &amp; POL</SectionTitle>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat label="expansion ETH" value={fmtEth(world.vaults.expansionEth)} />
            <Stat label="expansion gold" value={fmtWad(world.vaults.expansionGold, 3)} />
            <Stat label="contraction ETH" value={fmtEth(world.vaults.contractionEth)} />
            <Stat label="POL ETH" value={fmtEth(world.polEth)} />
            <Stat label="POL STD" value={fmtToken(world.polStd)} />
            <Stat label="pool spot" value={`${spotPriceEthPerStd(world.pool).toFixed(8)} ETH/STD`} />
          </div>
        </Card>

        <div
          role="status"
          aria-live="polite"
          aria-label={inv.ok ? "invariants OK" : `invariants FAIL: ${inv.failures.join(", ")}`}
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-card transition-colors duration-300 ${
            inv.ok
              ? "border-expansion/25 bg-expansion/[0.06] text-expansion"
              : "border-contraction/35 bg-contraction/[0.08] text-contraction"
          }`}
        >
          {inv.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="font-display font-medium uppercase tracking-widest">
              {inv.ok ? "invariants OK" : "invariants FAIL"}
            </p>
            {!inv.ok && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                {inv.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 lg:col-span-5">
        <Card className="space-y-5">
          <SectionTitle>Injectors</SectionTitle>

          <InjectorGroup label="Market">
            <div className="flex gap-2">
              <input
                value={buyEthAmount}
                onChange={(e) => setBuyEthAmount(e.target.value)}
                aria-label="ETH to spend buying STD"
                placeholder="ETH"
                inputMode="decimal"
                className={inputClass("w-24")}
              />
              <IconButton
                icon={TrendingUp}
                onClick={() => store.apply((w) => applySwap(w, "buyStd", parseAmount(buyEthAmount)))}
                tone="expansion"
              >
                buy STD (ETH)
              </IconButton>
            </div>
            <div className="flex gap-2">
              <input
                value={sellStdAmount}
                onChange={(e) => setSellStdAmount(e.target.value)}
                aria-label="STD to sell"
                placeholder="STD"
                inputMode="decimal"
                className={inputClass("w-24")}
              />
              <IconButton
                icon={TrendingDown}
                onClick={() => store.apply((w) => applySwap(w, "sellStd", parseAmount(sellStdAmount)))}
                tone="contraction"
              >
                sell STD
              </IconButton>
            </div>
          </InjectorGroup>

          <InjectorGroup label="Time">
            <div className="flex gap-2">
              <IconButton icon={Clock} onClick={() => store.apply((w) => tick(w, 3600))}>
                +1h
              </IconButton>
              <IconButton
                icon={Clock}
                onClick={() => store.apply((w) => tick(w, w.params.epochSeconds))}
              >
                +1 epoch
              </IconButton>
              <IconButton icon={Clock} onClick={() => store.apply((w) => tick(w, 86400))}>
                +1 day
              </IconButton>
            </div>
          </InjectorGroup>

          <InjectorGroup label="Charters">
            <div className="flex gap-2">
              <input
                value={seedCount}
                onChange={(e) => setSeedCount(e.target.value)}
                aria-label="Number of genesis charters to spawn"
                inputMode="numeric"
                className={inputClass("w-16")}
              />
              <IconButton
                icon={Users}
                onClick={() => store.apply((w) => seedGenesis(w, Number(seedCount) || 0))}
              >
                spawn genesis charters
              </IconButton>
            </div>
            <div className="flex gap-2">
              <input
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                aria-label="New charterDailyCap value"
                inputMode="numeric"
                className={inputClass("w-16")}
              />
              <IconButton
                icon={SlidersHorizontal}
                onClick={() =>
                  store.apply((w) => ({
                    ...w,
                    params: { ...w.params, charterDailyCap: Number(dailyCap) || 0 },
                    charterAuction: { ...w.charterAuction, cap: Number(dailyCap) || 0 },
                  }))
                }
              >
                force charterDailyCap
              </IconButton>
            </div>
            <div className="flex gap-2">
              <input
                value={charterOwnerKey}
                onChange={(e) => setCharterOwnerKey(e.target.value)}
                aria-label="New charter owner key"
                placeholder="owner key"
                className={inputClass("w-24")}
              />
              <IconButton
                icon={Landmark}
                disabled={world.params.charterDailyCap <= 0}
                onClick={() =>
                  store.apply((w) =>
                    buyCharter(w, charterOwnerKey || `owner-${w.now}-${w.day}`, quoteCharterPrice(w)),
                  )
                }
              >
                buy charter ({fmtEth(quoteCharterPrice(world))} ETH)
              </IconButton>
            </div>
            <div className="flex gap-2">
              <input
                value={dormantCharterId}
                onChange={(e) => setDormantCharterId(e.target.value)}
                aria-label="Charter id to report dormant"
                placeholder="charter id"
                className={inputClass("w-20")}
              />
              <input
                value={dormantReporterKey}
                onChange={(e) => setDormantReporterKey(e.target.value)}
                aria-label="Reporter key"
                placeholder="reporter"
                className={inputClass("w-24")}
              />
              <IconButton
                icon={Flag}
                onClick={() =>
                  store.apply((w) => reportDormant(w, dormantCharterId, dormantReporterKey || "reporter"))
                }
              >
                report dormant
              </IconButton>
            </div>
          </InjectorGroup>

          <InjectorGroup label="Scenarios">
            <div className="flex gap-2">
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                className={`${inputClass("flex-1")} appearance-none`}
              >
                {SCENARIO_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <IconButton icon={Play} onClick={() => loadScenarioById(scenarioId)} wide={false}>
                load scenario
              </IconButton>
            </div>
          </InjectorGroup>

          <InjectorGroup label="World">
            <IconButton icon={Download} full onClick={exportWorld}>
              export world JSON
            </IconButton>
            <IconButton
              icon={RotateCcw}
              full
              tone="contraction"
              onClick={() => store.apply(() => createWorld(DEFAULT_PARAMS, 0))}
            >
              reset world
            </IconButton>
            {process.env.NODE_ENV !== "production" && (
              <IconButton
                icon={Bug}
                full
                dashed
                tone="contraction"
                onClick={() => store.apply((w) => ({ ...w, polEth: -1n }))}
                title="Dev-only: directly corrupts polEth to demo the invariant pill failing. Not a legal action — reset world to recover."
              >
                debug: break POL (dev only)
              </IconButton>
            )}
          </InjectorGroup>
        </Card>

        <div>
          <button
            onClick={() => setShowConstants((v) => !v)}
            aria-expanded={showConstants}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-surface py-2 text-xs text-white/60 shadow-card transition-colors duration-150 hover:border-white/[0.15] hover:text-white/85"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            {showConstants ? "hide constants (params.json)" : "show constants (params.json)"}
          </button>
          {showConstants && (
            <div className="mt-3">
              <ConstantsDrawer params={world.params} />
            </div>
          )}
        </div>
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

function inputClass(width: string): string {
  return `${width} rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-sm text-paper/90 placeholder:text-white/25 transition-colors duration-150 focus:border-white/25 focus:outline-none`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-sm font-medium tracking-wide text-white/75">{children}</h3>;
}

function InjectorGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/30">{label}</p>
      {children}
    </div>
  );
}

function IconButton({
  icon: Icon,
  children,
  onClick,
  tone = "neutral",
  disabled,
  full,
  wide = true,
  dashed,
  title,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "neutral" | "expansion" | "contraction";
  disabled?: boolean;
  full?: boolean;
  wide?: boolean;
  dashed?: boolean;
  title?: string;
}) {
  const toneClass =
    tone === "expansion"
      ? "border-expansion/35 bg-expansion/10 text-expansion hover:bg-expansion/[0.16]"
      : tone === "contraction"
        ? "border-contraction/35 bg-contraction/10 text-contraction hover:bg-contraction/[0.16]"
        : "border-white/[0.08] bg-black/10 text-white/75 hover:bg-white/[0.06] hover:text-paper";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
        full ? "w-full" : wide ? "flex-1" : ""
      } ${dashed ? "border-dashed" : ""} ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/35">{label}</p>
      <p className="tabular mt-0.5 font-mono text-base text-white/90">{value}</p>
    </div>
  );
}
