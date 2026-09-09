"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { runFixtureWorld } from "@standard-law/sentinel";
import { fetchFixture } from "@/lib/attacks";
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
import { ConstantsDrawer } from "@/components/ConstantsDrawer";
import { EpochRing } from "@/components/EpochRing";
import { Guilloche } from "@/components/Guilloche";
import { RegimeBadge } from "@/components/RegimeBadge";
import { Sparkline } from "@/components/Sparkline";
import { fmtDuration, fmtEth, fmtToken, fmtWad } from "@/lib/format";
import { useEpochHistory, useSimStore, useWorld } from "@/lib/sim-context";
import { SCENARIO_IDS, fetchScenario } from "@/lib/scenarios";
import type { Scenario } from "@standard-law/engine";
import { EXPANSION, regimeStroke } from "@/lib/palette";

// recharts is 102kB gzipped -- 45% of this route's JavaScript -- for four
// charts that sit below every interactive control on the page. Loading it
// eagerly meant the Lab could not be used until the charting library had
// arrived. Split out, the controls hydrate on ~123kB (in line with every
// other route) and the charts stream in behind them.
//
// ssr:false because recharts measures the DOM to size itself and renders
// nothing useful on the server anyway. The placeholder reserves the charts'
// exact height so their arrival shifts nothing.
const Charts = dynamic(() => import("@/components/Charts").then((m) => m.Charts), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[281px] rounded-xl border border-white/[0.06] bg-surface shadow-card" />
      ))}
    </div>
  ),
});

export default function LabPage() {
  // fallback={null} meant the server sent a <main> containing literally zero
  // characters: a crawler, a link preview, and the first paint of a slow
  // connection all saw an empty page where the Lab's whole point is on
  // display. The fallback now describes the instrument in real markup, and
  // is replaced by the live version the moment it hydrates.
  return (
    <Suspense fallback={<LabSkeleton />}>
      <LabInner />
    </Suspense>
  );
}

/** Server-rendered stand-in: real text, no client state. */
function LabSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="space-y-4 lg:col-span-7">
        <Card>
          <h1 className="optical-title font-display text-2xl text-paper">The Lab</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
            The god view of the simulation. Drive the monetary policy directly: swap ETH for
            $STANDARD and back, advance the clock by an hour, a day or a whole epoch, spawn
            genesis charters, force the charter auction open, and watch the regime, the issuance
            multiplier m, the supply identities and the invariant pill respond in real time.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
            Five scripted scenarios replay worlds that each teach one behaviour — a week of
            inflow, an exodus, a wash trade, a licence mania and a ghost purge. Everything is
            deterministic and runs entirely in your browser.
          </p>
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-white/60">
            Loading the live world…
          </p>
        </Card>
      </section>
      <section className="space-y-4 lg:col-span-5">
        <Card>
          <h2 className="font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
            Injectors
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Market, time, charters, scenarios and world export — the controls that let you put
            the policy under load rather than read about it.
          </p>
        </Card>
      </section>
    </div>
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
  // Which Sentinel attack, if any, this world came from — so the page says
  // what you are looking at rather than leaving it to the URL.
  const [replayed, setReplayed] = useState<string | null>(null);

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

  /**
   * Loads the after-world of a Sentinel attack.
   *
   * The URL is the source of truth here, not a label. Sentinel used to apply
   * the world itself and then navigate to /lab?sentinel=<id>, which left the
   * parameter decorative: sharing or reloading that link gave you the demo
   * world under a URL claiming otherwise. Doing the load here makes the link
   * mean what it says.
   */
  async function loadAttackById(id: string) {
    try {
      const fixture = await fetchFixture(id);
      store.applyWorld(runFixtureWorld(fixture), `replay:${id}`);
      setReplayed(id);
    } catch {
      store.apply((w) => ({ ...w, lastError: "attack_load_failed" }));
    }
  }

  useEffect(() => {
    const fromUrl = searchParams.get("scenario");
    if (fromUrl && SCENARIO_IDS.includes(fromUrl as (typeof SCENARIO_IDS)[number])) {
      setScenarioId(fromUrl);
      void loadScenarioById(fromUrl);
    }
    const attack = searchParams.get("sentinel");
    if (attack) void loadAttackById(attack);
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
  const charters = Object.values(world.charters);
  const totalCharterCount = charters.length;
  const liveCharterCount = charters.filter((c) => c.alive).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {replayed && (
        <div
          data-testid="replay-banner"
          className="lg:col-span-12 rounded-lg border border-expansion/40 bg-expansion/10 px-4 py-2 text-xs text-expansion"
          role="status"
        >
          Showing the world left behind by{" "}
          <span className="font-mono">{replayed}</span> — not the demo world. Reset the world to
          get back.
        </div>
      )}
      <section className="space-y-4 lg:col-span-7">
        <Card className="relative overflow-hidden">
          <Guilloche
            uid="lab"
            stroke={regimeStroke(regime)}
            className="pointer-events-none absolute -right-36 -top-40 h-[320px] w-[320px] opacity-40"
          />
          {/* Stacked below sm. The epoch ring is a fixed ~140px, so on a
              390px phone this row left the rest of the card about 210px: the
              badge was shoved against the edge, "18h remaining" was clipped
              mid-word, and "net flow (this epoch)" wrapped to three lines.
              The ring reads perfectly well above the telemetry rather than
              beside it. */}
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
            <EpochRing
              epoch={world.epoch}
              elapsed={epochElapsed}
              total={world.params.epochSeconds}
            />
            <div className="w-full min-w-0 flex-1">
              {/* flex-wrap: the badge and the countdown cannot share a line on
                  a narrow phone, and forcing them to is what clipped the
                  countdown rather than wrapping it. */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <RegimeBadge regime={regime} />
                <span className="tabular font-mono text-xs text-white/55">
                  {fmtDuration(epochRemaining)} remaining
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/[0.06] pt-4 text-sm sm:grid-cols-4 sm:gap-y-4">
                {/* This epoch's flow updates on every swap; F_n only moves at
                    epoch close, so without it the Lab gave no feedback at all
                    for the thing it exists to let you inject. */}
                <Stat
                  label="net flow (this epoch)"
                  value={fmtEth(world.ethInEpoch - world.ethOutEpoch)}
                />
                <StatSpark
                  label="F_n (last epoch)"
                  value={fmtEth(world.F.at(-1) ?? 0n)}
                  series={history.map((h) => Number(h.F_n) / 1e18)}
                  stroke={regimeStroke((world.F.at(-1) ?? 0n) > 0n ? "expansion" : "contraction")}
                />
                <Stat label="signal" value={fmtEth(signal)} />
                <StatSpark label="m" value={world.m.toFixed(2)} series={history.map((h) => h.m)} />
              </div>
            </div>
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
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-white/60">
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
            <Stat
              label="pool spot (sim units)"
              value={`${spotPriceEthPerStd(world.pool).toFixed(8)} ETH/STD`}
            />
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
            <p className="font-sans text-[13px] font-semibold uppercase tracking-[0.16em]">
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

          <InjectorGroup
            label="Charters"
            hint={`${liveCharterCount} live / ${totalCharterCount} total · daily cap ${world.params.charterDailyCap}`}
          >
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

// No focus:outline-none here. Tailwind's version wins the specificity fight
// against the global :focus-visible rule, and the border tint it left behind
// (white/8 -> white/25) is not a focus indicator anyone can see on this
// ground. Letting the global gold ring through is the whole point.
function inputClass(width: string): string {
  return `${width} rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-sm text-paper/90 placeholder:text-white/45 transition-colors duration-150 focus:border-white/25`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">{children}</h3>;
}

function InjectorGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">{label}</p>
        {hint && <p className="tabular truncate font-mono text-[10px] text-white/45">{hint}</p>}
      </div>
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
      // min-w-0 is what lets the truncating label below actually truncate.
      // Without it a flex item refuses to shrink past its content, so at 320px
      // these buttons pushed the whole page sideways instead of clipping their
      // own text -- the label was set up to truncate and never got the chance.
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
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
      <p className="min-h-[2.7em] text-[11px] uppercase leading-[1.35] tracking-wide text-white/55">{label}</p>
      <p className="tabular mt-0.5 font-mono text-base text-white/90">{value}</p>
    </div>
  );
}

/** A stat with its own history ribbon underneath — "ribbons move" (spec §3). */
function StatSpark({
  label,
  value,
  series,
  stroke = EXPANSION,
}: {
  label: string;
  value: string;
  series: number[];
  stroke?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="min-h-[2.7em] text-[11px] uppercase leading-[1.35] tracking-wide text-white/55">{label}</p>
      <p className="tabular mt-0.5 font-mono text-base text-white/90">{value}</p>
      <Sparkline values={series} stroke={stroke} width={104} height={22} className="mt-1.5" />
    </div>
  );
}
