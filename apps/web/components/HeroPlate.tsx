"use client";

import { useEffect, useState } from "react";
import { OrbitalField } from "@/components/OrbitalField";

/** True while the viewport is narrow. Drives the tuning swap below. */
function useNarrow(query = "(max-width: 639px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

/**
 * The hero backdrop: the orbital field, tuned to sit *behind* type.
 *
 * The stock demo puts the art on one side and the copy on the other. This
 * hero is centred — the wordmark, the rule-and-eyebrow, the row of CTAs all
 * run down the middle — and rebuilding it as a split would have meant
 * redesigning the page around a background. So the Sun is dropped below the
 * frame instead, at the bottom centre, and the helices rise up through the
 * plate and fan out behind the type. The quiet band the copy needs is the
 * middle, which is exactly where a low Sun leaves one.
 *
 * That also makes the piece mean something here. The rosette it replaces was
 * a still engraving of orbits; this is the same figure with the mechanism
 * actually running, which is what the product is for.
 *
 * The scrim is left to the page. A canvas-side veil can only ramp from one
 * edge, and centred copy needs darkness in the middle — that is the radial
 * gradient already in page.tsx, tuned to this layout.
 */
export function HeroPlate() {
  const narrow = useNarrow();

  return (
    <OrbitalField
      // Below the frame, so the coils enter from underneath rather than
      // wrapping a Sun that would sit squarely behind the wordmark.
      focus={narrow ? [0.5, 0.90] : [0.5, 0.88]}
      lead={0}
      // Wider view on a phone: the plate is short there, and a tight view
      // turns the coils into near-vertical lines with no figure to read.
      viewRadius={narrow ? 2.6 : 2.15}
      // Dimmer on a phone, where the type takes nearly the whole plate and
      // the art has to drop back to texture.
      glow={narrow ? 0.55 : 0.9}
      starCount={narrow ? 420 : 900}
      // Slower than the stock 16s. This is a backdrop that people read over,
      // not a thing to watch; at the default speed the coils visibly crawl.
      yearSeconds={26}
      // The Sun's own course is a hard straight line, and against this much
      // curved gold it reads as a scratch across the plate rather than part of
      // the engraving. The coils carry the drift on their own.
      showSunTrack={false}
      scrim="none"
      // The pointer parallax is a nice touch on a hero, but every control on
      // this page sits on top of the plate, and nudging the camera while
      // somebody aims at a button is motion they did not ask for.
      interactive={false}
      className="!h-full !w-full"
    />
  );
}
