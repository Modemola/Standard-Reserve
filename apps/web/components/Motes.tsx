/**
 * Ambient gold motes — suspended leaf drifting in the vault light.
 *
 * Deliberately dependency-free (no tsparticles/framer-motion: ~150KB of JS
 * for background decoration would dwarf the engine itself). Positions are
 * derived from a deterministic hash of the index, not Math.random, so the
 * server and client markup match and hydration stays clean.
 *
 * Honours prefers-reduced-motion via the .mote rule in globals.css.
 */

/** Classic GLSL-style hash — deterministic, stable across server and client. */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const COUNT = 34;

const MOTES = Array.from({ length: COUNT }, (_, i) => {
  const size = 1 + hash(i, 1) * 2.2;
  return {
    left: hash(i, 2) * 100,
    top: 40 + hash(i, 3) * 70,
    size,
    // Smaller motes drift further and fade fainter — cheap depth cue.
    dy: 240 + hash(i, 4) * 320,
    dx: (hash(i, 5) - 0.5) * 90,
    duration: 26 + hash(i, 6) * 34,
    delay: -hash(i, 7) * 40,
    opacity: 0.18 + (1 - size / 3.2) * 0.4,
  };
});

export function Motes({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="mote absolute rounded-full bg-expansion"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
            ["--mote-dy" as string]: `${m.dy}px`,
            ["--mote-dx" as string]: `${m.dx}px`,
            ["--mote-opacity" as string]: m.opacity.toFixed(3),
            boxShadow: `0 0 ${(m.size * 3).toFixed(1)}px rgba(201,162,39,0.5)`,
          }}
        />
      ))}
    </div>
  );
}
