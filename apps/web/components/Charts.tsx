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
import type { EpochSnapshot } from "@/lib/sim-context";

const WAD = 1e18;
const AXIS_COLOR = "rgba(244,242,236,0.4)";
const GRID_COLOR = "rgba(244,242,236,0.08)";

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
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={netFlowData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="F" fill="#C9A227" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Issuance multiplier (m)">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={mData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} />
            <YAxis domain={[0, 1.5]} stroke={AXIS_COLOR} fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="stepAfter" dataKey="m" stroke="#C9A227" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="S_circ vs S_max (millions)">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={supplyData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="S_circ" stroke="#C9A227" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="S_max" stroke="#C0392B" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Expansion vault gold (grams)">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={goldData}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="epoch" stroke={AXIS_COLOR} fontSize={11} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="gold" stroke="#C9A227" fill="#C9A22733" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

const tooltipStyle = {
  background: "#0B0D10",
  border: "1px solid rgba(244,242,236,0.15)",
  fontSize: 12,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-2 text-sm font-medium text-white/70">{title}</h3>
      {children}
    </div>
  );
}
