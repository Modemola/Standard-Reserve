import type { Charter } from "@standard-law/engine";
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
              className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 p-3 text-center text-xs text-white/50 hover:border-expansion/40 hover:text-expansion disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="font-mono text-base">+</span>
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
            className="flex h-32 flex-col justify-between rounded-lg border border-white/10 bg-white/[0.04] p-3"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>branch {branch.id}</span>
                <span>{fmtDuration(age)} old</span>
              </div>
              <p className="tabular mt-1 font-mono text-lg">{fmtToken(branch.ledger)}</p>
              <p className="text-xs text-white/40">{pct.toFixed(2)}% of system</p>
            </div>
            <button
              onClick={() => onRetire(branch.id)}
              className="mt-2 rounded border border-white/15 py-1 text-xs text-white/70 hover:border-contraction/50 hover:text-contraction"
            >
              retire branch
            </button>
          </div>
        );
      })}
    </div>
  );
}
