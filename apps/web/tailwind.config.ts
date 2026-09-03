import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08090B",
        surface: "#111318",
        "surface-2": "#171A20",
        paper: "#F4F2EC",
        expansion: "#C9A227", // muted gold
        contraction: "#C0392B", // cold red
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
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
