"use client";

import { useMemo, useState } from "react";
import {
  buyLicense,
  checkIn,
  computeFeeRate,
  quoteLicense,
  quoteRetirement,
  retireBranch,
} from "@standard-law/engine";
import { CheckCircle2, Gauge } from "lucide-react";
import { AuctionClock } from "@/components/AuctionClock";
import { BranchRack } from "@/components/BranchRack";
import { Card } from "@/components/Card";
import { ExitTicket } from "@/components/ExitTicket";
import { RegimeBadge } from "@/components/RegimeBadge";
import { WhatIfDrawer } from "@/components/WhatIfDrawer";
import { fmtDuration, fmtEth, fmtPct, fmtToken } from "@/lib/format";
import { useSimStore, useWorld } from "@/lib/sim-context";

export default function BankPage({ params }: { params: { id: string } }) {
  const store = useSimStore();
  const world = useWorld();
  const [retiring, setRetiring] = useState<number | null>(null);

  const charter = world.charters[params.id];

  // Every hook has to run before the not-found return below. Calling useMemo
  // after it means the hook count changes the moment a charter stops
  // resolving -- a scenario load that drops this id, or a link to one that
  // was never seeded -- and React tears the whole page down with "rendered
  // fewer hooks than expected" rather than showing the empty state.
  const systemLedgerTotal = useMemo(() => {
    let total = 0n;
    for (const c of Object.values(world.charters)) {
      if (!c.alive) continue;
      for (const b of c.branches) if (b.alive) total += b.ledger;
    }
    return total;
  }, [world]);

  if (!charter) {
    return (
      <Card className="text-center">
        <p className="text-white/60">No charter {params.id} in this simulation.</p>
      </Card>
    );
  }

  const liveBranches = charter.branches.filter((b) => b.alive);
  const totalLedger = liveBranches.reduce((acc, b) => acc + b.ledger, 0n);

  const regime = world.F.length > 0 && (world.F.at(-1) ?? 0n) > 0n ? "expansion" : "contraction";
  const signal =
    (world.F.length >= 1 ? (world.F.at(-1) ?? 0n) : 0n) +
    (world.F.length >= 2 ? world.F[world.F.length - 2] : 0n);
  const idleFor = world.now - charter.lastInteraction;
  const timeToDormancy = Math.max(world.params.dormancySeconds - idleFor, 0);
  const feeRate = computeFeeRate(world);
  const licenseQuote = quoteLicense(world);

  const retireQuote = retiring !== null ? quoteRetirement(world, charter.id, retiring) : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <RegimeBadge regime={regime} size="lg" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="net flow this epoch" value={fmtEth(world.ethInEpoch - world.ethOutEpoch)} />
            <Stat label="signal" value={fmtEth(signal)} />
            <Stat label="m now" value={world.m.toFixed(2)} />
            <Stat label="live branches" value={`${liveBranches.length} / ${world.params.maxBranches}`} />
            <Stat label="total ledger" value={`${fmtToken(totalLedger)} STD`} />
            <Stat label="heartbeat" value={fmtDuration(timeToDormancy) + " to dormancy"} />
          </div>
          <button
            onClick={() => store.apply((w) => checkIn(w, charter.id))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-expansion/40 bg-expansion/10 px-4 py-2 text-sm text-expansion shadow-glow-expansion transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            check in
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <BranchRack
            charter={charter}
            now={world.now}
            systemLedgerTotal={systemLedgerTotal}
            licensePriceNow={licenseQuote.pNow}
            licenseRemainingToday={
              charter.licensesBoughtDay === world.day
                ? world.params.maxLicensesPerCharterPerDay - charter.licensesBoughtToday
                : world.params.maxLicensesPerCharterPerDay
            }
            onBuyLicense={() => store.apply((w) => buyLicense(w, charter.id))}
            onRetire={(branchId) => setRetiring(branchId)}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <AuctionClock title="License clock" auction={world.licenseAuction} now={world.now} unit="STD" />
          <AuctionClock
            title="Charter clock"
            auction={world.charterAuction}
            now={world.now}
            unit="ETH"
            disabled={world.params.charterDailyCap <= 0}
          />
          <Card className="text-sm">
            <h3 className="mb-2 flex items-center gap-1.5 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
              <Gauge className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
              Exit pressure
            </h3>
            <p className="text-white/55">current fee rate</p>
            <p className="tabular font-mono text-xl text-paper/95">{fmtPct(feeRate)}</p>
          </Card>
          <WhatIfDrawer world={world} charterId={charter.id} onCommit={(fn) => store.apply(fn)} />
        </div>
      </div>

      {retireQuote && (
        <ExitTicket
          quote={retireQuote}
          isLastBranch={liveBranches.length === 1}
          onConfirm={() => {
            store.apply((w) => retireBranch(w, charter.id, retireQuote.branchId));
            setRetiring(null);
          }}
          onCancel={() => setRetiring(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-white/55">{label}</p>
      <p className="tabular mt-0.5 font-mono text-white/90">{value}</p>
    </div>
  );
}
