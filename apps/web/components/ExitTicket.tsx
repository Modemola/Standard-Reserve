import type { Quote } from "@standard-law/engine";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-ink p-5">
        <h3 className="mb-4 font-mono text-sm uppercase tracking-widest text-white/60">
          Retire branch {quote.branchId}
        </h3>
        <dl className="space-y-2 text-sm">
          <Row label="Ledger" value={`${fmtToken(quote.ledger)} STD`} />
          <Row label="Locked fee rate" value={fmtPct(quote.feeRate)} />
          <Row label="Fee" value={`${fmtToken(quote.fee)} STD`} />
          <Row label="Mint to you" value={`${fmtToken(quote.mintToUser)} STD`} />
        </dl>
        {isLastBranch && (
          <p className="mt-4 rounded border border-contraction/30 bg-contraction/10 p-2 text-xs text-contraction">
            This is your last branch. Charter burns. Re-entry only via auction.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-white/15 px-3 py-1.5 text-sm text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded border border-contraction/40 bg-contraction/10 px-3 py-1.5 text-sm text-contraction"
          >
            Confirm retire
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/50">{label}</dt>
      <dd className="tabular font-mono">{value}</dd>
    </div>
  );
}
