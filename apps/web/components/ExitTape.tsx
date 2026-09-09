import type { ExitImpact } from "@standard-law/desk";
import { fmtPct, fmtToken } from "@/lib/format";

/** Burn vs rebate as a single proportional bar — where the run tax actually goes. */
function SplitBar({ burn, rebate }: { burn: bigint; rebate: bigint }) {
  const total = burn + rebate;
  const burnPct = total > 0n ? Number((burn * 10000n) / total) / 100 : 0;
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-contraction" style={{ width: `${burnPct}%` }} />
        <div className="h-full bg-expansion" style={{ width: `${100 - burnPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px]">
        <span className="text-contraction">burn {fmtToken(burn)}</span>
        <span className="text-expansion">rebate {fmtToken(rebate)}</span>
      </div>
    </div>
  );
}

export function ExitTape({
  impact,
  extraLedger,
  onExtraLedger,
  crowd,
  onCrowd,
}: {
  impact: ExitImpact | null;
  extraLedger: number;
  onExtraLedger: (v: number) => void;
  crowd: number;
  onCrowd: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-white/50">
        Exit tape — the run tax
      </h3>

      {!impact ? (
        <p className="text-xs text-white/55">No live branch to quote.</p>
      ) : (
        <>
          <p className="tabular font-mono text-3xl text-contraction" data-testid="exit-fee-now">
            {fmtPct(impact.feeRateNow)}
          </p>
          <p className="text-xs text-white/50">resolution fee right now</p>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-white/55">W (7d withdrawn)</dt>
              <dd className="tabular font-mono text-white/75">{fmtToken(impact.W)}</dd>
            </div>
            <div>
              <dt className="text-white/55">D (still at the bank)</dt>
              <dd className="tabular font-mono text-white/75">{fmtToken(impact.D)}</dd>
            </div>
            <div>
              <dt className="text-white/55">mint to you</dt>
              <dd className="tabular font-mono text-white/75">{fmtToken(impact.mintToUser)}</dd>
            </div>
            <div>
              <dt className="text-white/55">if the door crowds</dt>
              <dd className="tabular font-mono text-cheap" data-testid="exit-fee-crowded">
                {fmtPct(impact.feeRateIfRetireLvl)}
              </dd>
            </div>
          </dl>

          <div className="mt-3">
            <SplitBar burn={impact.burn} rebate={impact.rebate} />
          </div>

          {impact.lastBranch && (
            <p className="mt-3 rounded border border-contraction/30 bg-contraction/10 p-2 text-[11px] text-contraction">
              Last live branch. Retiring it burns the charter — re-entry only via auction.
            </p>
          )}
        </>
      )}

      <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
        <Slider
          label="extra ledger to retire (STD)"
          value={extraLedger}
          min={0}
          max={50000}
          step={500}
          onChange={onExtraLedger}
          display={extraLedger.toLocaleString()}
        />
        <Slider
          label="others retiring this week"
          value={crowd}
          min={0}
          max={100}
          step={1}
          onChange={onCrowd}
          display={String(crowd)}
        />
      </div>
      <p className="mt-2 text-[11px] text-white/55">
        Sliders quote against a clone. The live simulation is untouched until you commit in the
        cockpit.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-white/55">
        <span>{label}</span>
        <span className="tabular font-mono">{display}</span>
      </div>
      <input
        type="range"
        aria-label={`${label}: ${display}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // range-touch, not a bare range: an unstyled range renders a 16px
        // strip here, under the 24px WCAG 2.5.8 target floor and impossible
        // to grab with a thumb. Same utility the what-if sliders use.
        className="range-touch w-full cursor-pointer appearance-none bg-transparent accent-contraction"
      />
    </div>
  );
}
