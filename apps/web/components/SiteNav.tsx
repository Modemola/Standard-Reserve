"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/lab", label: "Lab" },
  { href: "/bank/c-0042", label: "Bank" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/law", label: "Law" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/75 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="font-serif text-sm font-medium tracking-[0.16em] text-paper/90"
          onClick={() => setOpen(false)}
        >
          STANDARD·LAW
        </Link>

        <ul className="hidden gap-6 text-sm md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="text-white/55 transition-colors duration-150 hover:text-paper">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="text-white/70 transition-colors duration-150 hover:text-paper md:hidden"
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
                className="block py-2 text-white/60 transition-colors duration-150 hover:text-paper"
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
