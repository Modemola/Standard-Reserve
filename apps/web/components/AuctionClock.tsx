import type { Auction } from "@standard-law/engine";
import { dutchPrice } from "@standard-law/engine";
import { fmtDuration, fmtWad } from "@/lib/format";

export function AuctionClock({
  title,
  auction,
  now,
  unit,
  disabled,
}: {
  title: string;
  auction: Auction;
  now: number;
  unit: string;
  disabled?: boolean;
}) {
  const elapsed = now - auction.opensAt;
  const priceNow = dutchPrice(auction.pStart, auction.pFloor, elapsed);
  const remaining = Math.max(auction.closesAt - now, 0);
  const soldFrac = auction.cap > 0 ? auction.sold / auction.cap : 0;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">{title}</h3>
        {disabled && <span className="text-xs text-white/40">closed</span>}
      </div>
      <p className="tabular font-mono text-2xl">
        {fmtWad(priceNow, 4)} <span className="text-sm text-white/50">{unit}</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-expansion/70"
          style={{ width: `${Math.min(100, soldFrac * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/50">
        <span>
          {auction.sold}/{auction.cap} sold
        </span>
        <span>decays over {fmtDuration(remaining)}</span>
      </div>
    </div>
  );
}
