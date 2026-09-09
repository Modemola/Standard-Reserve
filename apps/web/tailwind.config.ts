import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0D10",
        paper: "#F4F2EC",
        expansion: "#C9A227", // muted gold
        contraction: "#C0392B", // cold red
        // Sentinel verdicts. Held reads as "the rule stopped it", cheap as
        // "allowed but worth noting", broken as "an invariant failed".
        held: "#4E9A6A",
        cheap: "#D6A032",
        broken: "#C0392B"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["\"IBM Plex Mono\"", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
