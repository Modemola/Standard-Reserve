"use client";

import { useMemo, useState } from "react";
import {
  applySwap,
  buyLicense,
  computeFeeRate,
  retireBranch,
  supplyCirc,
  supplyMax,
  tick,
} from "@standard-law/engine";
import type { World } from "@standard-law/engine";
import { fmtPct, fmtToken } from "@/lib/format";

export function WhatIfDrawer({
  world,
  charterId,
  onCommit,
}: {
  world: World;
  charterId: string;
  onCommit: (fn: (w: World) => World) => void;
}) {
  const [flowEth, setFlowEth] = useState(0); // hypothetical remaining-epoch net ETH flow
  const [licensesToBuy, setLicensesToBuy] = useState(0);
  const [branchesToRetire, setBranchesToRetire] = useState(0);

  const charter = world.charters[charterId];
  const liveBranches = charter.branches.filter((b) => b.alive);
  const maxRetire = Math.max(liveBranches.length - 1, 0); // keep at least one during preview
  const maxLicenses = Math.min(3, charter.branches.filter((b) => !b.alive).length);

  const applyActions = (w0: World): World => {
    let w = w0;
    if (flowEth > 0) {
      w = applySwap(w, "buyStd", BigInt(Math.round(flowEth * 1e18)));
    } else if (flowEth < 0) {
      w = applySwap(w, "sellStd", BigInt(Math.round(-flowEth * 1e16))); // rough STD-equivalent notional
    }
    for (let i = 0; i < licensesToBuy; i++) w = buyLicense(w, charterId);
    const retireIds = liveBranches.slice(0, branchesToRetire).map((b) => b.id);
    for (const id of retireIds) w = retireBranch(w, charterId, id);
    return w;
  };

  const preview = useMemo(() => {
    let w = structuredClone(world);
    w = applyActions(w);
    const remaining = world.params.epochSeconds - (world.now - world.epochStartedAt);
    w = tick(w, Math.max(remaining, 0));
    return w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, flowEth, licensesToBuy, branchesToRetire, charterId]);

  const feeRateNow = computeFeeRate(world);
  const feeRatePreview = computeFeeRate(preview);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-medium text-white/70">What-if</h3>

      <Slider
        label="Remaining-epoch ETH flow"
        value={flowEth}
        min={-5}
        max={5}
        step={0.1}
        onChange={setFlowEth}
        display={`${flowEth >= 0 ? "+" : ""}${flowEth.toFixed(1)} ETH`}
      />
      <Slider
        label="Licenses to buy today"
        value={licensesToBuy}
        min={0}
        max={maxLicenses}
        step={1}
        onChange={setLicensesToBuy}
        display={`${licensesToBuy}`}
      />
      <Slider
        label="Branches to retire this week"
        value={branchesToRetire}
        min={0}
        max={maxRetire}
        step={1}
        onChange={setBranchesToRetire}
        display={`${branchesToRetire}`}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
        <Stat label="m now → preview" value={`${world.m.toFixed(2)} → ${preview.m.toFixed(2)}`} />
        <Stat
          label="S_circ now → preview"
          value={`${fmtToken(supplyCirc(world))} → ${fmtToken(supplyCirc(preview))}`}
        />
        <Stat label="feeRate now → preview" value={`${fmtPct(feeRateNow)} → ${fmtPct(feeRatePreview)}`} />
        <Stat
          label="S_max now → preview"
          value={`${fmtToken(supplyMax(world))} → ${fmtToken(supplyMax(preview))}`}
        />
      </div>

      <button
        onClick={() => onCommit(applyActions)}
        className="mt-4 w-full rounded border border-expansion/40 bg-expansion/10 py-2 text-sm text-expansion"
      >
        Commit on live sim
      </button>
      <p className="mt-2 text-center text-[10px] text-white/40">
        Nothing here touches the live simulation until you commit.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="tabular font-mono">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-expansion"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/40">{label}</p>
      <p className="tabular font-mono text-white/80">{value}</p>
    </div>
  );
}
