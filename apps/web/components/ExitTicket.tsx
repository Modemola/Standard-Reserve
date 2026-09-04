import type { Quote } from "@standard-law/engine";
import { AlertTriangle, LogOut } from "lucide-react";
import { fmtPct, fmtToken } from "@/lib/format";

export function ExitTicket({
  quote,
  isLastBranch,
  onConfirm,
  onCancel,
}: {
  quote: Quote;
  isLastBranch: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-ticket-title"
        className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-surface p-6 shadow-card"
      >
        <h3
          id="exit-ticket-title"
          className="mb-4 font-mono text-sm uppercase tracking-widest text-white/60"
        >
          Retire branch {quote.branchId}
        </h3>
        <dl className="space-y-2.5 text-sm">
          <Row label="Ledger" value={`${fmtToken(quote.ledger)} STD`} />
          <Row label="Locked fee rate" value={fmtPct(quote.feeRate)} />
          <Row label="Fee" value={`${fmtToken(quote.fee)} STD`} />
          <Row label="Mint to you" value={`${fmtToken(quote.mintToUser)} STD`} emphasize />
        </dl>
        {isLastBranch && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-contraction/25 bg-contraction/[0.08] p-3 text-xs text-contraction">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            This is your last branch. Charter burns. Re-entry only via auction.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/[0.1] px-3.5 py-1.5 text-sm text-white/70 transition-colors duration-150 hover:text-paper"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-contraction/40 bg-contraction/10 px-3.5 py-1.5 text-sm text-contraction transition-colors duration-150 hover:bg-contraction/[0.18]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Confirm retire
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/50">{label}</dt>
      <dd className={`tabular font-mono ${emphasize ? "text-expansion" : "text-paper/90"}`}>{value}</dd>
    </div>
  );
}
