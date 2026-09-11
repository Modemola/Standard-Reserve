"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { EXPLAIN, type ExplainKey } from "@/lib/explain";

/**
 * The plain-language explainer.
 *
 * A small ringed mark that sits beside a term or a button and, when pressed,
 * opens a panel saying what the thing actually is. Content lives in
 * `lib/explain.ts`; this file is only how it looks and behaves.
 *
 * Decisions worth knowing before editing:
 *
 * - **The trigger is a real 24x24 button.** It looks like a 15px mark, but
 *   the element itself meets WCAG 2.5.8, which `responsive.spec.ts` measures
 *   on the bounding box. Shrinking the box to match the glyph fails that gate
 *   on all four device sizes.
 * - **Below 640px it becomes a bottom sheet.** A 320px-wide phone cannot hold
 *   a floating panel beside its anchor without either overflowing the page —
 *   which the responsive gate treats as a defect — or being squeezed to
 *   uselessness.
 * - **Only one is open at a time**, coordinated by a window event rather than
 *   a provider, so any page can drop one in without wiring up context.
 * - **Closing is animated**, which means the panel outlives its own close by
 *   160ms. Hence the three-state machine instead of a boolean: unmounting on
 *   click is what makes a popover feel cheap.
 * - Motion rests in the right place when `prefers-reduced-motion` is set:
 *   globals.css collapses every duration to ~0, and these animations all use
 *   `both`, so they land on their final frame instead of never arriving.
 */

const OPEN_EVENT = "explain:open";
/** Keep in step with the exit animation in globals.css. */
const EXIT_MS = 160;
const SHEET_BELOW = 640;

type Phase = "closed" | "open" | "closing";

export function Explain({
  k,
  className = "",
  label,
  variant = "mark",
  children,
}: {
  /** Key into the glossary in lib/explain.ts. */
  k: ExplainKey;
  className?: string;
  /** Overrides the accessible name; defaults to the entry's own term. */
  label?: string;
  /**
   * "mark" is the ringed question mark, for headings and buttons that have
   * room beside them. "term" turns the label itself into the trigger with a
   * dotted rule under it, which costs no layout at all -- the stat grids are
   * four columns wide on desktop and two on a phone, and a 24px mark beside
   * an 11px label pushed them into worse wrapping than they already had.
   */
  variant?: "mark" | "term";
  /** The label text, for the "term" variant. */
  children?: React.ReactNode;
}) {
  const entry = EXPLAIN[k];
  const id = useId();
  const [phase, setPhase] = useState<Phase>("closed");
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; nub: number; above: boolean } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback((returnFocus = false) => {
    setPhase((p) => (p === "open" ? "closing" : p));
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Let the exit animation finish before the panel leaves the DOM.
  useEffect(() => {
    if (phase !== "closing") return;
    exitTimer.current = setTimeout(() => setPhase("closed"), EXIT_MS);
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [phase]);

  const open = useCallback(() => {
    // Tell every other explainer to stand down.
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setSheet(window.innerWidth < SHEET_BELOW);
    setPhase("open");
  }, [id]);

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) setPhase((p) => (p === "open" ? "closing" : p));
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);

  /**
   * Anchor the panel. Measured after paint so the real height is known:
   * guessing it is what produces a panel that hangs off the top of the
   * viewport for the longest entries.
   */
  const place = useCallback(() => {
    const t = triggerRef.current;
    const p = panelRef.current;
    if (!t || !p || sheet) return;

    const r = t.getBoundingClientRect();
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    const M = 12; // breathing room against the viewport edge
    const GAP = 10; // trigger to panel

    const roomBelow = window.innerHeight - r.bottom;
    const above = roomBelow < ph + GAP + M && r.top > ph + GAP + M;

    const wantLeft = r.left + r.width / 2 - pw / 2;
    const left = Math.min(Math.max(wantLeft, M), Math.max(window.innerWidth - pw - M, M));
    const top = above ? r.top - ph - GAP : r.bottom + GAP;

    // The nub tracks the trigger even after the panel has been shoved
    // sideways to stay on screen, so it still points at what it explains.
    const nub = Math.min(Math.max(r.left + r.width / 2 - left, 18), Math.max(pw - 18, 18));
    setPos({ top, left, nub, above });
  }, [sheet]);

  useLayoutEffect(() => {
    if (phase === "open") place();
  }, [phase, place]);

  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onMove = () => (sheet ? undefined : place());
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [phase, close, place, sheet]);

  // Triggers sit inside headings and labels that set case, tracking, family
  // and weight, and every one of those inherits. The panel therefore resets
  // all four explicitly -- two separate bugs shipped from forgetting this:
  // explanations in block capitals (from an uppercase label) and in bold
  // (from a font-semibold heading).
  const showing = phase !== "closed";
  const leaving = phase === "closing";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={phase === "open"}
        aria-controls={showing ? id : undefined}
        aria-label={`What is ${label ?? entry.term}?`}
        data-testid="explain-trigger"
        onClick={() => (phase === "open" ? close(true) : open())}
        className={
          variant === "term"
            ? // text-transform and letter-spacing are reset by the UA sheet on
              // form controls rather than inherited, so a label that was
              // uppercase before it became a trigger silently stopped being
              // uppercase. Inherit both back explicitly.
              `inline-flex min-h-6 min-w-6 items-center text-left underline decoration-expansion/40 decoration-dotted underline-offset-[3px] [letter-spacing:inherit] [text-transform:inherit] transition-colors duration-200 hover:decoration-expansion ${
                phase === "open" ? "text-expansion decoration-expansion" : "hover:text-white/80"
              } ${className}`
            : `inline-grid h-6 w-6 shrink-0 place-items-center rounded-full border align-middle transition-[color,background-color,border-color,transform] duration-200 ${
                phase === "open"
                  ? "border-expansion/60 bg-expansion/15 text-expansion"
                  : "border-white/15 bg-white/[0.03] text-white/45 hover:-translate-y-px hover:border-expansion/45 hover:bg-expansion/10 hover:text-expansion"
              } ${className}`
        }
      >
        {variant === "term" ? (
          children
        ) : (
          /* Optical centring: the glyph's own sidebearings make a plain "?"
             sit a hair right of true centre inside a circle this small. */
          <span aria-hidden className="-mr-px text-[11px] font-semibold leading-none">
            ?
          </span>
        )}
      </button>

      {showing && sheet && (
        <div
          aria-hidden
          onClick={() => close()}
          className={`fixed inset-0 z-[55] bg-ink/70 backdrop-blur-[2px] ${
            leaving ? "explain-scrim-out" : "explain-scrim-in"
          }`}
        />
      )}

      {showing && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={`${entry.term} — in plain English`}
          data-testid="explain-panel"
          style={
            sheet
              ? undefined
              : { top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }
          }
          className={
            sheet
              ? `fixed inset-x-3 bottom-3 z-[60] ${leaving ? "explain-sheet-out" : "explain-sheet-in"}`
              : `fixed z-[60] w-[19.5rem] max-w-[calc(100vw-1.5rem)] ${
                  leaving ? "explain-out" : "explain-in"
                }`
          }
        >
          <div className="relative overflow-hidden rounded-xl border border-white/[0.10] bg-surface-2/95 p-4 text-left font-sans font-normal normal-case tracking-normal shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_24px_56px_-16px_rgba(0,0,0,0.85)] backdrop-blur-md">
            {/* Engraved rule: a gold hairline drawing itself across the head
                of the panel, the same gesture as the plate borders. */}
            <span
              aria-hidden
              className="explain-rule absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-transparent via-expansion/70 to-transparent"
            />

            <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-expansion/75">
              In plain English
            </p>
            <h3 className="optical-title mt-1.5 font-serif text-[19px] leading-tight text-paper">
              {entry.term}
            </h3>

            <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{entry.plain}</p>

            {entry.more && (
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-white/60">{entry.more}</p>
            )}

            {entry.note && (
              <p className="mt-3 border-l-2 border-expansion/50 bg-expansion/[0.06] py-1.5 pl-2.5 pr-2 text-[12px] leading-relaxed text-white/70">
                {entry.note}
              </p>
            )}

            {sheet && (
              <button
                type="button"
                onClick={() => close(true)}
                className="mt-3.5 h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] text-[12px] font-medium tracking-wide text-white/70 transition-colors hover:border-white/20 hover:text-paper"
              >
                Got it
              </button>
            )}
          </div>

          {!sheet && pos && (
            <span
              aria-hidden
              style={{ left: pos.nub - 5 }}
              className={`explain-nub absolute h-2.5 w-2.5 rotate-45 border-white/[0.10] bg-surface-2 ${
                pos.above ? "-bottom-[5px] border-b border-r" : "-top-[5px] border-l border-t"
              }`}
            />
          )}
        </div>
      )}
    </>
  );
}
