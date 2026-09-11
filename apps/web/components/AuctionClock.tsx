import type { Auction } from "@standard-law/engine";
import { Explain } from "@/components/Explain";
import type { ExplainKey } from "@/lib/explain";
import { dutchPrice } from "@standard-law/engine";
import { Timer } from "lucide-react";
import { Card } from "@/components/Card";
import { fmtDuration, fmtWad } from "@/lib/format";

export function AuctionClock({
  title,
  explain,
  auction,
  now,
  unit,
  disabled,
}: {
  title: string;
  explain?: ExplainKey;
  auction: Auction;
  now: number;
  unit: string;
  disabled?: boolean;
}) {
  const elapsed = now - auction.opensAt;
  const priceNow = dutchPrice(auction.pStart, auction.pFloor, elapsed);
  const remaining = Math.max(auction.closesAt - now, 0);
  const soldFrac = auction.cap > 0 ? auction.sold / auction.cap : 0;
  // Design language 3: 2-4 decimals for ETH, 2 for tokens. This rendered
  // everything at 4, so the licence clock quoted STD to four places while the
  // rack beside it quoted the same price to two.
  const decimals = unit === "ETH" ? 4 : 2;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
          <Timer className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
          {title}
          {explain && <Explain k={explain} label={title} />}
        </h3>
        {disabled && (
          <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
            closed
          </span>
        )}
      </div>

      {disabled ? (
        /*
         * A closed book shows no price at all.
         *
         * This used to render the decaying quote with a small "closed" pill
         * beside it, which reads as a live market: the charter clock sat at
         * "0.2279 ETH / 0 of 0 sold" while the policy cap was zero and nothing
         * could be bought. WP 8 and the Desk's own charter board both say a
         * closed market must not render a tradable price, and the Desk already
         * honoured that -- so the two surfaces disagreed about the same fact.
         */
        <div data-testid="auction-closed">
          <p className="font-mono text-lg uppercase tracking-[0.2em] text-white/45">unopened</p>
          <p className="mt-1 text-xs text-white/55">
            No market today: the policy cap is 0, so there is no price to quote.
          </p>
        </div>
      ) : (
        <>
          <p className="tabular font-mono text-2xl text-paper/95" data-testid="auction-price">
            {fmtWad(priceNow, decimals)} <span className="text-sm text-white/45">{unit}</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-expansion/70 to-expansion transition-[width] duration-500"
              style={{ width: `${Math.min(100, soldFrac * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-white/45">
            <span>
              {auction.sold}/{auction.cap} sold
            </span>
            <span>decays over {fmtDuration(remaining)}</span>
          </div>
        </>
      )}
    </Card>
  );
}
