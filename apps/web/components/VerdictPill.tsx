import type { VerdictStatus } from "@standard-law/sentinel";

const STYLE: Record<VerdictStatus, string> = {
  held: "border-held/40 bg-held/10 text-held",
  cheap: "border-cheap/40 bg-cheap/10 text-cheap",
  broken: "border-broken/50 bg-broken/15 text-broken",
  pending: "border-white/15 bg-white/5 text-white/40",
};

export function VerdictPill({ status, size = "sm" }: { status: VerdictStatus; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      data-testid={`verdict-${status}`}
      className={`inline-block rounded border font-mono uppercase tracking-widest ${dims} ${STYLE[status]}`}
    >
      {status}
    </span>
  );
}
