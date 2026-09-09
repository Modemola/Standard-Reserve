import type { Auction } from "@standard-law/engine";
import { dutchPrice } from "@standard-law/engine";
import { Timer } from "lucide-react";
import { Card } from "@/components/Card";
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
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/75">
          <Timer className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
          {title}
        </h3>
        {disabled && (
          <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
            closed
          </span>
        )}
      </div>
      <p className="tabular font-mono text-2xl text-paper/95">
        {fmtWad(priceNow, 4)} <span className="text-sm text-white/45">{unit}</span>
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
    </Card>
  );
}
