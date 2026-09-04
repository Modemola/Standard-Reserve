import type { Regime } from "@standard-law/engine";

export function RegimeBadge({ regime, size = "md" }: { regime: Regime; size?: "md" | "lg" }) {
  const isExpansion = regime === "expansion";
  const sizeClasses = size === "lg" ? "px-9 py-5 text-4xl gap-3" : "px-4 py-2 text-base gap-2";
  const dotSize = size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2";

  return (
    <span
      data-testid="regime-badge"
      role="status"
      aria-label={`regime: ${regime}`}
      className={`inline-flex items-center rounded-xl border font-serif font-medium uppercase tracking-[0.08em] ${sizeClasses} ${
        isExpansion
          ? "border-expansion/30 bg-gradient-to-br from-expansion/[0.14] to-expansion/[0.04] text-expansion shadow-glow-expansion"
          : "border-contraction/30 bg-gradient-to-br from-contraction/[0.14] to-contraction/[0.04] text-contraction shadow-glow-contraction"
      }`}
    >
      <span
        aria-hidden="true"
        className={`animate-pulse-soft rounded-full ${dotSize} ${isExpansion ? "bg-expansion" : "bg-contraction"}`}
      />
      {regime}
    </span>
  );
}
