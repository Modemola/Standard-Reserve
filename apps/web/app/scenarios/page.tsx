import Link from "next/link";
import { Play } from "lucide-react";
import { Card } from "@/components/Card";
import { SCENARIO_IDS, SCENARIO_TITLES } from "@/lib/scenarios";

export default function ScenariosPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-paper/95">Scenarios</h1>
        <p className="mt-1 text-sm text-white/55">
          Bundled JSON worlds that exercise specific parts of the policy engine.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIO_IDS.map((id) => {
          const meta = SCENARIO_TITLES[id];
          return (
            <Card key={id}>
              <h2 className="font-mono text-sm text-white/80">{id}</h2>
              <p className="mt-1 text-sm text-white/60">{meta.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-white/40">{meta.teach}</p>
              <Link
                href={`/lab?scenario=${id}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-expansion/40 bg-expansion/10 px-3 py-1.5 text-xs text-expansion transition-colors duration-150 hover:bg-expansion/[0.18]"
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                Play in Lab
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
