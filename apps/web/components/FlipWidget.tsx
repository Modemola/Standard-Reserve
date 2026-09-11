import type { FlipQuote } from "@standard-law/desk";
import { Explain } from "@/components/Explain";
import { fmtEth } from "@/lib/format";

/**
 * The biggest number on the Desk: the ETH it takes to change the sign of this
 * epoch's net flow. Sized so it cannot be missed at 1280px.
 */
export function FlipWidget({ quote }: { quote: FlipQuote }) {
  const toExpansion = quote.ethToFlipToExpansion > 0n;
  const amount = toExpansion ? quote.ethToFlipToExpansion : quote.ethToFlipToContraction;
  const target = toExpansion ? "expansion" : "contraction";
  const tone = toExpansion ? "text-expansion" : "text-contraction";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-1.5 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white/85">
        ETH to flip sign
        <Explain k="flip" />
      </h3>
      <p
        data-testid="flip-eth"
        className={`tabular mt-2 font-mono text-5xl leading-none ${tone} sm:text-6xl`}
      >
        {fmtEth(amount)}
      </p>
      <p className="mt-2 text-sm text-white/60">
        net {toExpansion ? "inflow" : "outflow"} still needed to close{" "}
        <span className={tone}>{target}</span>
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs">
        <div>
          <dt className="text-white/55">regime now</dt>
          <dd data-testid="flip-regime-now" className="font-mono text-white/80">
            {quote.regimeNow}
          </dd>
        </div>
        <div>
          <dt className="text-white/55">if epoch ended now</dt>
          <dd data-testid="flip-regime-live" className="font-mono text-white/80">
            {quote.regimeIfEpochEndedNow}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-white/55">F_n this epoch</dt>
          <dd className="tabular font-mono text-white/80">{fmtEth(quote.Fn)} ETH</dd>
        </div>
      </dl>
    </div>
  );
}
