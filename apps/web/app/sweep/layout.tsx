import type { Metadata } from "next";

/** page.tsx is a client component (it owns a Worker), so the route's metadata
 *  lives in a server layout beside it. */
export const metadata: Metadata = {
  title: "Sweep",
  description:
    "Run a grid of parameter values across a fixed market and see where the monetary policy degenerates.",
};

export default function SweepLayout({ children }: { children: React.ReactNode }) {
  return children;
}
