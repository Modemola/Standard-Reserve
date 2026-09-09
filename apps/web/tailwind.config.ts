import type { Config } from "tailwindcss";
import { CHEAP, CONTRACTION, EXPANSION, HELD } from "./lib/palette";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08090B",
        surface: "#111318",
        "surface-2": "#171A20",
        paper: "#F4F2EC",
        expansion: EXPANSION, // muted gold
        // Cold red, lifted from #C0392B. The original was 3.66:1 on ink and
        // 3.4:1 on the card surfaces -- below AA for normal text -- which put
        // the contraction regime label, the error toast, and the sell/reset
        // buttons under the threshold. This clears 4.5:1 on every surface in
        // the palette while staying the same brick hue.
        contraction: CONTRACTION,
        // Sentinel verdicts. Held reads as "the rule stopped it", cheap as
        // "allowed but worth noting". Broken reuses the contraction red
        // rather than the pre-lift #C0392B, which would fail AA on these
        // surfaces. Measured on the card surface: held 5.58:1, cheap 8.10:1.
        held: HELD,
        cheap: CHEAP,
        broken: CONTRACTION,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Display didone — large sizes only; hairlines disappear under ~20px.
        serif: ["var(--font-serif)", "Georgia", "serif"],
        display: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 12px 32px -12px rgba(0,0,0,0.6)",
        "glow-expansion": "0 0 0 1px rgba(201,162,39,0.25), 0 0 24px -4px rgba(201,162,39,0.35)",
        "glow-contraction": "0 0 0 1px rgba(192,57,43,0.3), 0 0 24px -4px rgba(192,57,43,0.4)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
