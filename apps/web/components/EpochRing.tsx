import { fmtDuration } from "@/lib/format";

/** Instrument-style epoch dial: how far through the current epoch we are. */
export function EpochRing({
  epoch,
  elapsed,
  total,
  size = 132,
}: {
  epoch: number;
  elapsed: number;
  total: number;
  size?: number;
}) {
  const frac = total > 0 ? Math.min(Math.max(elapsed / total, 0), 1) : 0;
  const stroke = 3;
  const r = (size - stroke * 2) / 2 - 6;
  const circumference = 2 * Math.PI * r;
  const remaining = Math.max(total - elapsed, 0);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <g transform={`translate(${size / 2} ${size / 2})`}>
          {/* tick marks — 24 hours of an epoch */}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const inner = r + 5;
            const outer = r + (i % 6 === 0 ? 11 : 8);
            return (
              <line
                key={i}
                x1={Math.cos(a) * inner}
                y1={Math.sin(a) * inner}
                x2={Math.cos(a) * outer}
                y2={Math.sin(a) * outer}
                stroke="#F4F2EC"
                strokeOpacity={i % 6 === 0 ? 0.28 : 0.12}
                strokeWidth={i % 6 === 0 ? 1.2 : 0.8}
              />
            );
          })}
          <circle r={r} fill="none" stroke="#F4F2EC" strokeOpacity="0.08" strokeWidth={stroke} />
          <circle
            r={r}
            fill="none"
            stroke="#C9A227"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">epoch</span>
        <span className="tabular font-serif text-2xl font-medium leading-none text-paper/95">{epoch}</span>
        <span className="tabular mt-1 font-mono text-[10px] text-white/40">{fmtDuration(remaining)} left</span>
      </div>
    </div>
  );
}
