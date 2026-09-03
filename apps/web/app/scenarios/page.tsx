import Link from "next/link";
import { SCENARIO_IDS, SCENARIO_TITLES } from "@/lib/scenarios";

export default function ScenariosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scenarios</h1>
        <p className="mt-1 text-sm text-white/60">
          Bundled JSON worlds that exercise specific parts of the policy engine.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIO_IDS.map((id) => {
          const meta = SCENARIO_TITLES[id];
          return (
            <div key={id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h2 className="font-mono text-sm text-white/80">{id}</h2>
              <p className="mt-1 text-sm text-white/60">{meta.title}</p>
              <p className="mt-2 text-xs text-white/40">{meta.teach}</p>
              <Link
                href={`/lab?scenario=${id}`}
                className="mt-3 inline-block rounded border border-expansion/40 bg-expansion/10 px-3 py-1 text-xs text-expansion"
              >
                Play in Lab
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
