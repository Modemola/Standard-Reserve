import type { CharterBoard } from "@standard-law/desk";
import { fmtEth } from "@/lib/format";

/**
 * A closed charter book is a tombstone, not a teaser. With the daily cap at
 * zero there is no price to show, so none is rendered.
 */
export function CharterTombstone({ board }: { board: CharterBoard }) {
  if (!board.open) {
    return (
      <div
        data-testid="charter-tombstone"
        className="flex h-full flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center"
      >
        <p className="font-mono text-3xl uppercase tracking-[0.3em] text-white/55">unopened</p>
        <p className="mt-3 text-xs text-white/55">
          Charter auctions are closed. Policy cap is 0, so there is no market and no price.
        </p>
        <p className="mt-1 text-[11px] text-white/55">
          Raise charterDailyCap in the Lab to open the book.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-white/50">
        Charter book
      </h3>
      <p data-testid="charter-price" className="tabular font-mono text-3xl text-expansion">
        {fmtEth(board.pNow ?? 0n)} <span className="text-sm text-white/50">ETH</span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-white/55">sold today</dt>
          <dd className="tabular font-mono text-white/75">
            {board.sold}/{board.cap}
          </dd>
        </div>
        <div>
          <dt className="text-white/55">floor</dt>
          <dd className="tabular font-mono text-white/75">{fmtEth(board.pFloor ?? 0n)}</dd>
        </div>
      </dl>
    </div>
  );
}
