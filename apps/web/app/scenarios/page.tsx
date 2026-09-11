import type { Metadata } from "next";
import { Explain } from "@/components/Explain";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";
import {
  DEFAULT_PARAMS,
  GENESIS_POL,
  SimStore,
  createWorld,
  supplyCirc,
} from "@standard-law/engine";
import type { Scenario } from "@standard-law/engine";
import { Card } from "@/components/Card";
import { Guilloche } from "@/components/Guilloche";
import { fmtToken } from "@/lib/format";
import { SCENARIO_IDS, SCENARIO_TITLES } from "@/lib/scenarios";

export const metadata: Metadata = {
  title: "Scenarios",
  description:
    "Five scripted replays — an exodus, a licence mania, a ghost purge and more — each teaching one behaviour of the monetary policy.",
};

interface Outcome {
  regime: "expansion" | "contraction";
  epochs: number;
  m: number;
  burned: bigint;
  circDelta: bigint;
}

/**
 * Replay a scenario and report where it lands.
 *
 * This runs on the server at build time, not in the browser: the page is
 * static, so every reader gets numbers that were produced by actually running
 * the engine over the shipped JSON rather than a caption someone typed and
 * forgot to update. If a scenario file ever stops doing what its blurb claims,
 * the card changes on the next build instead of quietly lying.
 *
 * A throw here fails the build, which is the right outcome for a malformed
 * scenario — it is the same file the Lab will try to load.
 */
function outcomeOf(id: string): Outcome {
  const raw = readFileSync(join(process.cwd(), "public", "scenarios", `${id}.json`), "utf8");
  const store = new SimStore(createWorld(DEFAULT_PARAMS, 0));
  store.loadScenario(JSON.parse(raw) as Scenario, DEFAULT_PARAMS);
  const w = store.world;
  const F = w.F.at(-1) ?? 0n;
  return {
    regime: F > 0n ? "expansion" : "contraction",
    epochs: w.epoch,
    m: w.m,
    burned: w.B,
    circDelta: supplyCirc(w) - GENESIS_POL,
  };
}

export default function ScenariosPage() {
  const scenarios = SCENARIO_IDS.map((id) => ({
    id,
    meta: SCENARIO_TITLES[id],
    outcome: outcomeOf(id),
  }));

  return (
    <div className="space-y-10">
      <section className="relative isolate overflow-hidden pb-2">
        <Guilloche
          uid="scenarios"
          className="pointer-events-none absolute -right-40 -top-52 -z-10 h-[380px] w-[380px] opacity-30"
        />
        <h1 className="optical-title flex items-center gap-2.5 font-display text-3xl text-paper">
          Scenarios
          <Explain k="scenario" label="a scenario" />
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Five scripted worlds, each built to isolate one behaviour of the policy and make it
          impossible to miss. They are ordinary JSON — a list of timestamped actions — replayed
          against the same engine the Lab runs, so a scenario proves a point rather than
          illustrating one.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          The figures on each card are not captions. They are produced by running that scenario
          at build time, so if a file ever stops doing what its description claims, the card
          changes with it.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map(({ id, meta, outcome }, i) => {
          const isExpansion = outcome.regime === "expansion";
          return (
            <Card key={id} className="group relative flex flex-col overflow-hidden">
              {/* Ghost numeral, matching the landing page's four loops. */}
              <span
                aria-hidden="true"
                className="tabular absolute right-4 top-3 font-mono text-4xl font-bold text-white/[0.04] transition-colors duration-300 group-hover:text-expansion/[0.14]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <h2 className="font-mono text-[13px] text-white/75">{id}</h2>
              <p className="optical-title mt-1 font-display text-xl text-paper">{meta.title}</p>
              <p className="mt-3 flex-1 text-xs leading-relaxed text-white/60">{meta.teach}</p>

              {/* What actually happens when you run it. */}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 font-mono text-[11px]">
                <Fact label="ends in">
                  <span className={isExpansion ? "text-expansion" : "text-contraction"}>
                    {outcome.regime}
                  </span>
                </Fact>
                <Fact label="epochs">{outcome.epochs}</Fact>
                <Fact label="m lands at">{outcome.m.toFixed(2)}</Fact>
                <Fact label="burned">
                  {outcome.burned > 0n ? `${fmtToken(outcome.burned)} STD` : "—"}
                </Fact>
              </dl>

              <Link
                href={`/lab?scenario=${id}`}
                className="mt-4 inline-flex items-center gap-1.5 self-start rounded-lg border border-expansion/40 bg-expansion/10 px-3.5 py-1.5 text-xs text-expansion transition-colors duration-150 hover:bg-expansion/[0.18]"
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                Play in Lab
                <ArrowRight
                  className="h-3 w-3 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Card>
          );
        })}

        {/* The fifth card leaves a gap on a three-column grid; rather than an
            empty cell, point somewhere useful. */}
        <Card className="flex flex-col justify-center border-dashed bg-transparent">
          <p className="text-xs leading-relaxed text-white/60">
            Scenarios show what the policy does on one path. To ask whether it holds across a
            range of parameter values — and where it degenerates — run a sweep.
          </p>
          <Link
            href="/sweep"
            className="mt-4 inline-flex items-center gap-1.5 self-start rounded-lg border border-white/[0.14] px-3.5 py-1.5 text-xs text-paper/85 transition-colors duration-150 hover:bg-white/[0.06]"
          >
            Open Sweep
            <ArrowRight className="h-3 w-3 opacity-60" aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-white/55">{label}</dt>
      <dd className="tabular mt-0.5 text-white/90">{children}</dd>
    </div>
  );
}
