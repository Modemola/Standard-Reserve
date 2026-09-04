import type { Charter } from "@standard-law/engine";
import { LogOut, Plus } from "lucide-react";
import { fmtDuration, fmtToken } from "@/lib/format";

export function BranchRack({
  charter,
  now,
  systemLedgerTotal,
  licensePriceNow,
  licenseRemainingToday,
  onBuyLicense,
  onRetire,
}: {
  charter: Charter;
  now: number;
  systemLedgerTotal: bigint;
  licensePriceNow: bigint;
  licenseRemainingToday: number;
  onBuyLicense: () => void;
  onRetire: (branchId: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {charter.branches.map((branch) => {
        if (!branch.alive) {
          return (
            <button
              key={branch.id}
              onClick={onBuyLicense}
              disabled={licenseRemainingToday <= 0}
              aria-label={`Buy license for empty branch slot ${branch.id}, ${fmtToken(licensePriceNow)} STD, ${licenseRemainingToday} of 3 remaining today`}
              className="flex h-32 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/[0.12] bg-black/10 p-3 text-center text-xs text-white/45 transition-colors duration-150 hover:border-expansion/40 hover:bg-expansion/[0.04] hover:text-expansion disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Buy license</span>
              <span className="tabular font-mono">{fmtToken(licensePriceNow)} STD</span>
              <span>remaining {licenseRemainingToday}/3</span>
            </button>
          );
        }

        const pct =
          systemLedgerTotal > 0n ? Number((branch.ledger * 10000n) / systemLedgerTotal) / 100 : 0;
        const age = now - branch.openedAt;

        return (
          <div
            key={branch.id}
            className="flex h-32 flex-col justify-between rounded-xl border border-white/[0.06] bg-surface p-3 shadow-card"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] text-white/45">
                <span>branch {branch.id}</span>
                <span>{fmtDuration(age)} old</span>
              </div>
              <p className="tabular mt-1 font-mono text-lg text-paper/95">{fmtToken(branch.ledger)}</p>
              <p className="text-[11px] text-white/55">{pct.toFixed(2)}% of system</p>
            </div>
            <button
              onClick={() => onRetire(branch.id)}
              aria-label={`Retire branch ${branch.id}, ledger ${fmtToken(branch.ledger)} STD`}
              className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-white/[0.1] py-1 text-xs text-white/65 transition-colors duration-150 hover:border-contraction/45 hover:text-contraction"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              retire branch
            </button>
          </div>
        );
      })}
    </div>
  );
}
