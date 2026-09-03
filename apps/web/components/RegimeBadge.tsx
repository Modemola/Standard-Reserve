import type { Regime } from "@standard-law/engine";

export function RegimeBadge({ regime, size = "md" }: { regime: Regime; size?: "md" | "lg" }) {
  const isExpansion = regime === "expansion";
  const sizeClasses = size === "lg" ? "px-8 py-4 text-3xl" : "px-4 py-2 text-base";
  return (
    <span
      data-testid="regime-badge"
      className={`inline-flex items-center gap-2 rounded-md border font-mono uppercase tracking-widest ${sizeClasses} ${
        isExpansion
          ? "border-expansion/40 bg-expansion/10 text-expansion"
          : "border-contraction/40 bg-contraction/10 text-contraction"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isExpansion ? "bg-expansion" : "bg-contraction"}`} />
      {regime}
    </span>
  );
}
