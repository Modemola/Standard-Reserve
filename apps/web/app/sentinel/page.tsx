"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runAttack, runAttackWorld } from "@standard-law/sentinel";
import type { AttackFixture, Verdict } from "@standard-law/sentinel";
import { AttackDetail } from "@/components/AttackDetail";
import { AttackList } from "@/components/AttackList";
import { fetchAllFixtures } from "@/lib/attacks";
import { useSimStore } from "@/lib/sim-context";

/** Once a full run is measured slower than this, stop auto-running on arrival. */
const AUTORUN_BUDGET_MS = 2000;
const SLOW_KEY = "sentinel:slow";

export default function SentinelPage() {
  const store = useSimStore();
  const router = useRouter();

  const [fixtures, setFixtures] = useState<AttackFixture[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    fetchAllFixtures()
      .then((f) => {
        setFixtures(f);
        setSelectedId((cur) => cur ?? f[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  /** Attacks run one per frame so a long suite cannot freeze the tab. */
  const runMany = useCallback(async (list: AttackFixture[]) => {
    setBusy(true);
    const started = performance.now();
    for (const f of list) {
      await new Promise((r) => setTimeout(r, 0));
      try {
        const v = runAttack(f);
        setVerdicts((prev) => ({ ...prev, [v.id]: v }));
      } catch (e) {
        setError(`${f.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const elapsed = performance.now() - started;
    if (list.length > 1 && elapsed > AUTORUN_BUDGET_MS) {
      try {
        sessionStorage.setItem(SLOW_KEY, "1");
      } catch {
        // Private-mode storage failures are not worth surfacing.
      }
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    if (autoRan.current || fixtures.length === 0) return;
    autoRan.current = true;
    let slow = false;
    try {
      slow = sessionStorage.getItem(SLOW_KEY) === "1";
    } catch {
      slow = false;
    }
    if (!slow) void runMany(fixtures);
  }, [fixtures, runMany]);

  const selected = useMemo(
    () => fixtures.find((f) => f.id === selectedId) ?? null,
    [fixtures, selectedId],
  );
  const selectedVerdict = selectedId ? verdicts[selectedId] : undefined;

  const counts = useMemo(() => {
    const list = Object.values(verdicts);
    return {
      held: list.filter((v) => v.status === "held").length,
      cheap: list.filter((v) => v.status === "cheap").length,
      broken: list.filter((v) => v.status === "broken").length,
      total: fixtures.length,
    };
  }, [verdicts, fixtures.length]);

  function replayInLab() {
    if (!selected) return;
    try {
      store.applyWorld(runAttackWorld(selected), `replay:${selected.id}`);
      setToast(`Loaded ${selected.id} into the live sim`);
      setTimeout(() => router.push(`/lab?sentinel=${selected.id}`), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function download() {
    if (!selectedVerdict) return;
    const blob = new Blob([JSON.stringify(selectedVerdict, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedVerdict.id}.verdict.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sentinel</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            Hostile physics. Each fixture below is an attack replayed against the same engine the
            Lab and the Cockpit run on. Attacks are against the local engine, not mainnet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular font-mono text-xs text-white/50">
            {counts.held} held · {counts.cheap} cheap · {counts.broken} broken ·{" "}
            {counts.total} total
          </span>
          <button
            onClick={() => void runMany(fixtures)}
            disabled={busy || fixtures.length === 0}
            data-testid="run-all"
            className="rounded border border-expansion/40 bg-expansion/10 px-3 py-1.5 text-sm text-expansion disabled:opacity-40"
          >
            {busy ? "Running…" : "Run all"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded border border-broken/40 bg-broken/10 p-3 text-xs text-broken">
          {error}
        </p>
      )}
      {toast && (
        <p className="rounded border border-expansion/40 bg-expansion/10 p-3 text-xs text-expansion">
          {toast}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-5">
          {fixtures.length === 0 && !error ? (
            <p className="rounded border border-white/10 p-4 text-sm text-white/40">
              Loading attack catalogue…
            </p>
          ) : (
            <AttackList
              fixtures={fixtures}
              verdicts={verdicts}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </section>

        <section className="lg:col-span-7">
          {selected ? (
            Object.keys(verdicts).length === 0 && !busy ? (
              <div className="rounded-lg border border-white/10 p-6 text-center">
                <p className="text-sm text-white/60">Run all attacks.</p>
                <button
                  onClick={() => void runMany(fixtures)}
                  className="mt-3 rounded border border-expansion/40 bg-expansion/10 px-3 py-1.5 text-sm text-expansion"
                >
                  Run all
                </button>
              </div>
            ) : (
              <AttackDetail
                fixture={selected}
                verdict={selectedVerdict}
                busy={busy}
                onRunThis={() => void runMany([selected])}
                onReplayInLab={replayInLab}
                onDownload={download}
              />
            )
          ) : null}
        </section>
      </div>
    </div>
  );
}
