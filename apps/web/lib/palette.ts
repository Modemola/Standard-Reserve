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

/** The stroke for a regime, for SVG and chart props. */
export function regimeStroke(regime: "expansion" | "contraction"): string {
  return regime === "expansion" ? EXPANSION : CONTRACTION;
}
