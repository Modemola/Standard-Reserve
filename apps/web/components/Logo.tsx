import { EXPANSION } from "@/lib/palette";

/**
 * The mark — an engraved seal.
 *
 * Three ideas, each doing work:
 *
 *   Guilloché ring. The interference engraving used on banknotes, share
 *   certificates and passports since the 18th century, and already this app's
 *   signature texture. It says "issued by a bank" without resorting to a
 *   column, a vault door or a shield.
 *
 *   Milled rim. The rosette's 23 lobe cusps break the outer rule the way
 *   reeding breaks the edge of a struck coin.
 *
 *   Didone S. Standard, set in the same face as the wordmark — the typography
 *   of share certificates and banknotes.
 *
 * There is deliberately no rule struck through the S. Currency symbols are
 * built by striking a letter ($ ¢ ₦ ₮ ₽ ₿), and the first draft of this mark
 * did exactly that — which produced a gold coin with a dollar sign on it. For
 * a protocol issuing its own currency, borrowing the dollar's glyph is the
 * wrong signal twice over, and it is the most worn cliché in the category.
 * The engraving is what makes this mark uncommon, so the engraving carries it.
 *
 * Everything is generated, nothing is a raster, and the geometry is
 * deterministic so the server and client render identically.
 *
 * The `S` is set in the app's display face rather than drawn as a path, so it
 * is the real Bodoni where the font has loaded and a system serif where it has
 * not — a logo that depends on a webfont having arrived is a logo that is
 * sometimes missing.
 */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Hypotrochoid, same generator as the background rosettes. */
function rosette(R: number, r: number, d: number, samplesPerLoop = 22): string {
  const loops = r / gcd(R, r);
  const steps = Math.round(loops * samplesPerLoop);
  const k = (R - r) / r;
  let path = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * loops;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    path += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return path + "Z";
}

/**
 * One rosette, solved rather than chosen by eye.
 *
 * A hypotrochoid spans radius |(R−r)−d| to (R−r)+d, and its lobe count is
 * R/gcd(R,r). Setting R−r=36 and d=9 pins the curve to the annulus 27–45 —
 * exactly the gap between the letter's clear space and the rim — and gcd(46,10)
 * = 2 gives 23 evenly spaced lobes.
 *
 * The `d < r` part is what makes it engraving rather than scribble. When d
 * exceeds r the curve throws crossing loops and the ring reads as a thorn
 * tangle; the first attempt used d=9 against r=5 and looked exactly like that.
 * Keeping d under r produces the smooth sinuous interference a real guilloché
 * lathe cuts.
 *
 * An earlier draft also layered two rosettes *and* 60 milling ticks. Three
 * competing textures in a 20px band do not read as engraving. One curve does,
 * and its 23 cusps break the outer rule the way reeding breaks a coin edge.
 */
const ROSETTE = rosette(46, 10, 9);

export function Logo({
  size = 28,
  stroke = EXPANSION,
  className = "",
  uid = "logo",
  title,
}: {
  size?: number;
  stroke?: string;
  className?: string;
  /** Unique per instance: two identical mask ids on one page break both. */
  uid?: string;
  /** Give it a title only when the mark stands alone. Beside the wordmark it
   *  is decorative, and announcing it would just repeat the name. */
  title?: string;
}) {
  // Below ~32px the guilloché collapses into a grey smudge and the milling
  // aliases into a dotted ring. The seal keeps its rings, its strike and its
  // S, and drops what can no longer be seen.
  const detailed = size >= 32;
  const maskId = `${uid}-mask`;

  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Keeps the engraving in the rim and out from behind the letter. */}
        <mask id={maskId}>
          <rect x="-50" y="-50" width="100" height="100" fill="black" />
          <circle cx="0" cy="0" r="46" fill="white" />
          {/* Open centre, the way banknote guilloché leaves room for the
              portrait — and here, for the letter. */}
          <circle cx="0" cy="0" r="27" fill="black" />
        </mask>
      </defs>

      {detailed && (
        <g mask={`url(#${maskId})`} stroke={stroke} fill="none">
          <path d={ROSETTE} strokeWidth={0.7} opacity={0.55} strokeLinejoin="round" />
        </g>
      )}

      {/* Two rules: the coin's edge and the seal's inner border. */}
      <circle cx="0" cy="0" r="47" fill="none" stroke={stroke} strokeWidth={2} opacity={0.9} />
      <circle cx="0" cy="0" r="39" fill="none" stroke={stroke} strokeWidth={1} opacity={0.45} />

      <text
        x="0"
        y="1"
        textAnchor="middle"
        dominantBaseline="central"
        fill={stroke}
        style={{
          fontFamily: "var(--font-serif), Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          fontSize: 50,
        }}
      >
        S
      </text>
    </svg>
  );
}
