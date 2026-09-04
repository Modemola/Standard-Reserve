import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/Card";
import { DEMO_CHARTER_ID } from "@/lib/demo-seed";

/** Any URL that isn't one of the four real routes. Without this the reader
 *  gets Next's unstyled default 404, which drops them out of the app's shell
 *  entirely and gives them no way back in. */
export default function NotFound() {
  return (
    <Card className="mx-auto max-w-xl space-y-4 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">404</p>
      <h1 className="optical-title font-display text-2xl text-paper">No such page</h1>
      <p className="text-sm leading-relaxed text-white/60">
        This address isn&apos;t part of the simulator. Everything lives under the four
        routes below.
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {[
          { href: "/", label: "Home" },
          { href: `/bank/${DEMO_CHARTER_ID}`, label: "Bank" },
          { href: "/lab", label: "Lab" },
          { href: "/scenarios", label: "Scenarios" },
          { href: "/law", label: "Law" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 text-sm text-paper/85 transition-colors duration-150 hover:bg-white/[0.08]"
          >
            {l.label}
            <ArrowRight className="h-3 w-3 opacity-60" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </Card>
  );
}
