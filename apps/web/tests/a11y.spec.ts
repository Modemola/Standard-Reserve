import { expect, test } from "@playwright/test";

/**
 * Accessibility guards.
 *
 * Both of these were real regressions found by measuring rather than looking:
 * the app shipped with no focus styles at all (and inputs that explicitly
 * stripped the browser's), and with body text as low as white/25 — a 2.1:1
 * ratio against the ink background, which fails WCAG AA at every size. A
 * build can pass types, lint, and every other e2e test with both defects
 * present, so they need their own gate.
 */

const ROUTES = ["/", "/bank/c-0042", "/lab", "/sweep", "/scenarios", "/law"];

/** WCAG relative luminance, then the contrast ratio between two sRGB colours. */
function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = ([r, g, b]: [number, number, number]) =>
    0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

test("every keyboard stop has a visible focus indicator", async ({ page }) => {
  await page.goto("/lab");

  // Tab far enough to cross the nav, the scenario controls, and into the
  // Lab's own inputs, which are the ones that used to swallow the ring.
  const seen: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const transparent = /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(s.outlineColor);
      const width = parseFloat(s.outlineWidth) || 0;
      return {
        name: `${el.tagName}:${(el.textContent || (el as HTMLInputElement).placeholder || "").trim().slice(0, 24)}`,
        hasRing: width >= 1 && !transparent,
      };
    });
    if (!stop) break;
    expect(stop.hasRing, `no visible focus ring on ${stop.name}`).toBe(true);
    seen.push(stop.name);
  }

  // Guards the guard: if tabbing stopped finding anything, the assertions
  // above would vacuously pass.
  expect(seen.length).toBeGreaterThan(10);
  expect(seen.some((n) => n.startsWith("INPUT"))).toBe(true);
});

test("the nav marks exactly one link as the current page", async ({ page }) => {
  // Every link used to render identically on all five routes, so nothing --
  // visual or assistive -- said where you were.
  for (const route of [...ROUTES, "/bank/c-9999"]) {
    await page.goto(route);
    // toHaveCount, not allTextContents(): the latter is a one-shot read with
    // no retry, so a slow hydration makes it observe zero links and fail for
    // a reason that has nothing to do with the nav.
    await expect(
      page.locator("header a[aria-current='page']"),
      `wrong aria-current on ${route}`,
    ).toHaveCount(1);
  }
  // A charter other than the demo one is still the Bank section.
  await page.goto("/bank/c-9999");
  await expect(page.locator("header a[aria-current='page']")).toHaveText(/Bank/);
});

for (const route of ROUTES) {
  test(`text on ${route} meets WCAG AA contrast`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const failures = await page.evaluate(() => {
      const parseRgb = (s: string): [number, number, number, number] => {
        const m = s.match(/[\d.]+/g)!.map(Number);
        return [m[0], m[1], m[2], m[3] ?? 1];
      };
      // Walk up for the first opaque background, then composite the text
      // colour's own alpha over it — text-white/45 is what this is for.
      const bgOf = (el: Element): [number, number, number] => {
        let node: Element | null = el;
        while (node) {
          const [r, g, b, a] = parseRgb(getComputedStyle(node).backgroundColor);
          if (a > 0.9) return [r, g, b];
          node = node.parentElement;
        }
        return [8, 9, 11];
      };
      const out: { text: string; fg: number[]; bg: number[]; size: number; bold: boolean }[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const direct = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent || "")
          .join("")
          .trim();
        if (!direct) continue;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.9) continue;
        // Gradient-filled text (the foil hero headline) is painted by its
        // background through background-clip:text, so its computed `color`
        // is transparent by design. Measuring that reports 1:1 for glyphs
        // that are in fact the brightest thing on the page.
        if (s.webkitBackgroundClip === "text" || s.backgroundClip === "text") continue;
        const [r, g, b, a] = parseRgb(s.color);
        const bg = bgOf(el);
        const fg: [number, number, number] = [
          Math.round(r * a + bg[0] * (1 - a)),
          Math.round(g * a + bg[1] * (1 - a)),
          Math.round(b * a + bg[2] * (1 - a)),
        ];
        out.push({
          text: direct.slice(0, 40),
          fg,
          bg,
          size: parseFloat(s.fontSize),
          bold: parseInt(s.fontWeight, 10) >= 700,
        });
      }
      return out;
    });

    const bad = failures
      .map((f) => {
        // WCAG "large text" is >=24px, or >=18.66px bold; everything else
        // needs 4.5:1. The ghost numerals behind the loop cards are the one
        // deliberate exception — they are pure ornament at white/[0.04] and
        // are duplicated as a real heading beside them.
        const large = f.size >= 24 || (f.bold && f.size >= 18.66);
        const need = large ? 3 : 4.5;
        const ratio = contrastRatio(f.fg as [number, number, number], f.bg as [number, number, number]);
        return { ...f, ratio, need };
      })
      .filter((f) => f.ratio < f.need && !/^0[1-4]$/.test(f.text));

    expect(
      bad.map((f) => `"${f.text}" ${f.ratio.toFixed(2)}:1 (needs ${f.need}) at ${f.size}px`),
    ).toEqual([]);
  });
}
