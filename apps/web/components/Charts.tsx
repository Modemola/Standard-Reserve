"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CONTRACTION, EXPANSION } from "@/lib/palette";
import type { EpochSnapshot } from "@/lib/sim-context";

const WAD = 1e18;
const AXIS_COLOR = "rgba(244,242,236,0.35)";
const GRID_COLOR = "rgba(244,242,236,0.06)";
// From lib/palette, not copied: these were literals until the red was
// lifted for contrast and the charts kept drawing the old failing #C0392B.
const GOLD = EXPANSION;
const RED = CONTRACTION;

function toUnits(v: bigint): number {
  return Number(v) / WAD;
}

export function Charts({ history }: { history: EpochSnapshot[] }) {
  const netFlowData = history.map((h) => ({ epoch: h.epoch, F: toUnits(h.F_n) }));
  const mData = history.map((h) => ({ epoch: h.epoch, m: h.m }));
  const supplyData = history.map((h) => ({
    epoch: h.epoch,
    S_circ: toUnits(h.supplyCirc) / 1_000_000,
    S_max: toUnits(h.supplyMax) / 1_000_000,
  }));
  const goldData = history.map((h) => ({ epoch: h.epoch, gold: toUnits(h.gold) }));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ChartCard title="Net flow by epoch">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={netFlowData}>
            <defs>
              <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.95} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="F" fill="url(#barGold)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Issuance multiplier (m)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, 1.5]}
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip {...tooltipProps} />
            <Line type="stepAfter" dataKey="m" stroke={GOLD} dot={false} strokeWidth={2.5} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="S_circ vs S_max (millions)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={supplyData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey="S_circ" stroke={GOLD} dot={false} strokeWidth={2.5} />
            <Line type="monotone" dataKey="S_max" stroke={RED} dot={false} strokeWidth={2.5} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Expansion vault gold (grams)">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={goldData}>
            <defs>
              <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipProps} />
            <Area type="monotone" dataKey="gold" stroke={GOLD} strokeWidth={2.5} fill="url(#areaGold)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

const tooltipProps = {
  contentStyle: {
    background: "#111318",
    border: "1px solid rgba(244,242,236,0.1)",
    borderRadius: 10,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    boxShadow: "0 12px 32px -12px rgba(0,0,0,0.6)",
  },
  labelStyle: { color: "rgba(244,242,236,0.5)" },
  cursor: { fill: "rgba(244,242,236,0.03)" },
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface p-5 shadow-card">
      <h3 className="mb-3 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">{title}</h3>
      {children}
    </div>
  );
}
