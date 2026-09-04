/**
 * Guilloché — the interference-pattern engraving used on banknotes, share
 * certificates and passports since the 18th century. Generated here as
 * hypotrochoids (spirograph curves): a point at distance `d` from the centre
 * of a circle of radius `r` rolling inside a circle of radius `R`.
 *
 *   x = (R-r)·cos t + d·cos((R-r)/r · t)
 *   y = (R-r)·sin t − d·sin((R-r)/r · t)
 *
 * Masked to an annulus, the way real banknote guilloché leaves its centre
 * open for the portrait or denomination — which also keeps the dense knot
 * of curves out from behind whatever text sits on top.
 *
 * Deterministic (no randomness) so server and client render identically —
 * this is a server component and must not break hydration.
 */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function rosette(R: number, r: number, d: number, samplesPerLoop = 16): string {
  const loops = r / gcd(R, r);
  const steps = Math.round(loops * samplesPerLoop);
  const k = (R - r) / r;
  let path = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * loops;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    path += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return path + "Z";
}

const LAYERS = [
  { path: rosette(200, 61, 96), opacity: 0.55, width: 0.45, spin: "animate-[spin_240s_linear_infinite]" },
  { path: rosette(190, 47, 118), opacity: 0.4, width: 0.4, spin: "animate-[spin_180s_linear_infinite_reverse]" },
  { path: rosette(170, 83, 64), opacity: 0.3, width: 0.35, spin: "animate-[spin_320s_linear_infinite]" },
];

export function Guilloche({ className = "", uid = "g0" }: { className?: string; uid?: string }) {
  const maskId = `guilloche-mask-${uid}`;
  const gradId = `guilloche-grad-${uid}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="-260 -260 520 520"
      className={`pointer-events-none select-none ${className}`}
    >
      <defs>
        {/* Annulus: open centre, engraved ring, feathered outer edge. */}
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="22%" stopColor="#fff" stopOpacity="0" />
          <stop offset="46%" stopColor="#fff" stopOpacity="1" />
          <stop offset="76%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="-260" y="-260" width="520" height="520" fill={`url(#${gradId})`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} fill="none" stroke="#C9A227">
        {LAYERS.map((layer, i) => (
          <g key={i} className={layer.spin} style={{ transformOrigin: "center" }}>
            <path d={layer.path} strokeWidth={layer.width} strokeOpacity={layer.opacity} />
          </g>
        ))}
        <circle r="232" strokeWidth="0.5" strokeOpacity="0.2" />
        <circle r="226" strokeWidth="0.3" strokeOpacity="0.12" />
      </g>
    </svg>
  );
}
