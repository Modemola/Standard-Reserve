"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DEMO_CHARTER_ID } from "@/lib/demo-seed";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/lab", label: "Lab" },
  // Derived, not hardcoded: changing the demo charter must not silently
  // leave this link pointing at a charter that no longer exists.
  { href: `/bank/${DEMO_CHARTER_ID}`, label: "Bank" },
  { href: "/sweep", label: "Sweep" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/law", label: "Law" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The nav gave no indication of the current page -- every link rendered
  // identically on all five routes, so neither a sighted reader nor a screen
  // reader could tell where they were.
  //
  // Compare first path segments rather than the whole href: the Bank link
  // carries a specific charter id, and /bank/<some other id> is still the
  // Bank section. Home is the empty segment, so it only matches "/" and does
  // not light up everywhere.
  const segment = (path: string) => path.split("/")[1] ?? "";
  const isCurrent = (href: string) => segment(href) === segment(pathname ?? "/");

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/75 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="-my-2.5 py-2.5 font-serif text-sm font-medium tracking-[0.16em] text-paper/90"
          onClick={() => setOpen(false)}
        >
          STANDARD·LAW
        </Link>

        <ul className="hidden gap-4 text-sm md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={isCurrent(n.href) ? "page" : undefined}
                // -my-2.5 py-2.5: the desktop nav is what an iPad uses, and
                // these links measured exactly 24x24 -- the WCAG floor, with
                // nothing spare. The negative margin keeps the bar's height.
                className={
                  isCurrent(n.href)
                    ? "-mx-2 -my-2.5 block px-2 py-2.5 text-paper transition-colors duration-150"
                    : "-mx-2 -my-2.5 block px-2 py-2.5 text-white/55 transition-colors duration-150 hover:text-paper"
                }
              >
                {n.label}
                {/* Colour alone must not be the only signal (WCAG 1.4.1), so
                    the current page also carries a rule under it. */}
                <span
                  aria-hidden="true"
                  className={`mt-1 block h-px ${isCurrent(n.href) ? "bg-expansion/70" : "bg-transparent"}`}
                />
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          // -m-2.5 p-2.5 grows the hit area to 44px without moving the icon: the
          // glyph is 20px, which is under the 24px WCAG 2.5.8 floor and less
          // than half the 44px iOS target, on the one control a phone user
          // needs most.
          className="-m-2.5 p-2.5 text-white/70 transition-colors duration-150 hover:text-paper md:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>

      {open && (
        <ul className="border-t border-white/[0.06] bg-ink/95 px-4 py-3 text-sm md:hidden">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={isCurrent(n.href) ? "page" : undefined}
                className={
                  isCurrent(n.href)
                    ? "block border-l-2 border-expansion/70 py-2 pl-2 text-paper"
                    : "block border-l-2 border-transparent py-2 pl-2 text-white/60 transition-colors duration-150 hover:text-paper"
                }
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
