import type { AttackFixture, Verdict } from "@standard-law/sentinel";
import { VerdictPill } from "./VerdictPill";

export function AttackList({
  fixtures,
  verdicts,
  selectedId,
  onSelect,
}: {
  fixtures: AttackFixture[];
  verdicts: Record<string, Verdict>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
      {fixtures.map((f) => {
        const v = verdicts[f.id];
        const selected = f.id === selectedId;
        return (
          <li key={f.id}>
            <button
              onClick={() => onSelect(f.id)}
              data-testid={`attack-${f.id}`}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/[0.04] ${
                selected ? "bg-white/[0.06]" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs text-white/80">{f.id}</span>
                <span className="block truncate text-[11px] text-white/40">{f.title}</span>
              </span>
              <VerdictPill status={v ? v.status : "pending"} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
