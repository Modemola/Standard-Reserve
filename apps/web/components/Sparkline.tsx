"use client";

import { useId } from "react";
import { EXPANSION } from "@/lib/palette";

/** Inline ribbon chart — the "ribbons move" half of the spec's motion rule. */
export function Sparkline({
  values,
  stroke = EXPANSION,
  width = 120,
  height = 28,
  fill = true,
  className = "",
}: {
  values: number[];
  stroke?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  // Must be unique per instance: two ribbons with the same stroke and the
  // same history length would otherwise emit identical gradient ids, which
  // is invalid HTML and lets one shadow the other.
  const gradId = `spark${useId().replace(/:/g, "")}`;

  // With fewer than two points there is no line to draw yet — show a dim
  // baseline so the slot reads as "no history yet" rather than broken.
  if (values.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden="true">
        <line
          x1="2"
          y1={height - 3}
          x2={width - 2}
          y2={height - 3}
          stroke={stroke}
          strokeOpacity="0.18"
          strokeWidth="1.5"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const area = `${line}L${pts[pts.length - 1][0].toFixed(2)} ${height}L${pts[0][0].toFixed(2)} ${height}Z`;

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path
        d={line}
        pathLength={1}
        className="draw"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
