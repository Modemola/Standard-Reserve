"use client";

import { invariantCheck, spotPriceEthPerStd, supplyCirc } from "@standard-law/engine";
import { fmtEth, fmtToken } from "@/lib/format";
import { useWorld } from "@/lib/sim-context";

/**
 * Persistent status strip — the machine is always running, on every route.
 * Deliberately does not reuse RegimeBadge (its data-testid must stay unique).
 */
export function Ticker() {
  const world = useWorld();
  const regime = world.F.length > 0 && (world.F.at(-1) ?? 0n) > 0n ? "expansion" : "contraction";
  const isExpansion = regime === "expansion";
  const inv = invariantCheck(world);

  return (
    <div className="relative border-b border-white/[0.06] bg-black/25">
      <div className="mx-auto flex max-w-6xl items-center gap-0 overflow-x-auto px-4 py-1.5 font-mono text-[11px]">
        <span className="flex shrink-0 items-center gap-1.5 pr-3 text-white/35">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-expansion opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-expansion" />
          </span>
          LIVE
        </span>
        <Cell label="epoch" value={String(world.epoch)} />
        <Cell
          label="regime"
          value={regime}
          className={isExpansion ? "text-expansion" : "text-contraction"}
        />
        <Cell label="m" value={world.m.toFixed(2)} />
        <Cell label="S_circ" value={fmtToken(supplyCirc(world))} />
        <Cell label="F_n" value={fmtEth(world.F.at(-1) ?? 0n)} />
        <Cell label="spot" value={`${spotPriceEthPerStd(world.pool).toFixed(8)}`} />
        <Cell
          label="inv"
          value={inv.ok ? "ok" : "fail"}
          className={inv.ok ? "text-expansion/80" : "text-contraction"}
        />
      </div>
    </div>
  );
}

function Cell({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1.5 border-l border-white/[0.07] px-3">
      <span className="uppercase tracking-[0.12em] text-white/30">{label}</span>
      <span className={`tabular ${className || "text-white/70"}`}>{value}</span>
    </span>
  );
}
