/**
 * The two semantic colours, in one place.
 *
 * These are needed as literal hex strings by SVG attributes (stroke, fill)
 * and by recharts, none of which can read a Tailwind class. They were
 * previously copy-pasted into six files, and when the contraction red was
 * lifted from #C0392B to #DC5546 for contrast, three of those copies were
 * missed -- the Lab's rosette, one sparkline, and every chart kept drawing
 * the old, failing red. Nothing caught it: the contrast gate inspects text
 * colours, not SVG strokes.
 *
 * tailwind.config.ts imports these too, so the class-based and
 * attribute-based colours cannot drift apart again.
 */
export const EXPANSION = "#C9A227";
export const CONTRACTION = "#DC5546";

/**
 * Sentinel verdicts. Held reads as "the rule stopped it", cheap as "allowed,
 * but the incentive is worth naming". Measured against the card surface:
 * held 5.58:1, cheap 8.10:1 — both clear AA for normal text.
 *
 * There is no separate BROKEN: it reuses CONTRACTION. A distinct red would
 * have to clear the same contrast bar and would read as a second failure
 * colour, when a broken invariant and a contracting regime are the same
 * "this is the bad direction" signal.
 */
export const HELD = "#4E9A6A";
export const CHEAP = "#D6A032";

/** The stroke for a regime, for SVG and chart props. */
export function regimeStroke(regime: "expansion" | "contraction"): string {
  return regime === "expansion" ? EXPANSION : CONTRACTION;
}
