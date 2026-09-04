import type { Metadata } from "next";

/** page.tsx is a client component and so cannot export metadata itself.
 *  A server layout alongside it is the standard way to give the route its
 *  own title without making the page a server component. */
export const metadata: Metadata = {
  title: "Lab",
  description:
    "Drive the monetary policy directly: swap, tick the clock, seed charters, load scenarios, and watch the invariants hold.",
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
