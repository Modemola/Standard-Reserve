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

const ROUTES = ["/", "/bank/c-0042", "/lab", "/desk", "/sweep", "/sentinel", "/scenarios", "/law"];

/** WCAG relative luminance, then the contrast ratio between two sRGB colours. */
function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
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
      const transparent = /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(
        s.outlineColor,
      );
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
  await expect(page.locator("header a[aria-current='page']")).toHaveText(
    /Bank/,
  );
});

/** Measure every text node on the page as it currently stands. */
async function contrastFailures(page: import("@playwright/test").Page) {
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
    const out: {
      text: string;
      fg: number[];
      bg: number[];
      size: number;
      bold: boolean;
    }[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const direct = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent || "")
        .join("")
        .trim();
      if (!direct) continue;
      const s = getComputedStyle(el);
      if (
        s.visibility === "hidden" ||
        s.display === "none" ||
        parseFloat(s.opacity) < 0.9
      )
        continue;
      // WCAG 1.4.3 exempts text that is pure decoration, and aria-hidden is
      // the machine-readable marker for exactly that — the ghost numerals
      // behind the cards, for instance, which are duplicated as real headings
      // beside them. This replaced a hardcoded `^0[1-4]$` allowlist that
      // silently stopped covering anything the moment a fifth card appeared.
      // Keying on aria-hidden is self-maintaining, and it cannot be abused to
      // hide real content because doing that would be its own, larger bug.
      if (el.closest('[aria-hidden="true"]')) continue;
      // Gradient-filled text (the foil hero headline) is painted by its
      // background through background-clip:text, so its computed `color`
      // is transparent by design. Measuring that reports 1:1 for glyphs
      // that are in fact the brightest thing on the page.
      if (s.webkitBackgroundClip === "text" || s.backgroundClip === "text")
        continue;
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

  return failures
    .map((f) => {
      // WCAG "large text" is >=24px, or >=18.66px bold; everything else
      // needs 4.5:1. The ghost numerals behind the loop cards are the one
      // deliberate exception — they are pure ornament at white/[0.04] and
      // are duplicated as a real heading beside them.
      const large = f.size >= 24 || (f.bold && f.size >= 18.66);
      const need = large ? 3 : 4.5;
      const ratio = contrastRatio(
        f.fg as [number, number, number],
        f.bg as [number, number, number],
      );
      return { ...f, ratio, need };
    })
    .filter((f) => f.ratio < f.need)
    .map(
      (f) =>
        `"${f.text}" ${f.ratio.toFixed(2)}:1 (needs ${f.need}) at ${f.size}px`,
    );
}

for (const route of ROUTES) {
  test(`text on ${route} meets WCAG AA contrast`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(await contrastFailures(page)).toEqual([]);
  });
}

test("the sweep grid meets WCAG AA contrast once it has results", async ({
  page,
}) => {
  // The route-level check above loads /sweep empty, so the grid, the verdict
  // list and the selected-cell panel -- the great majority of that page, and
  // all of its colour-carrying UI -- were never measured by anything. An
  // empty page passing says nothing about the page people actually read.
  test.setTimeout(120_000);
  await page.goto("/sweep");
  await page.getByRole("button", { name: "choppy" }).click();
  await page.getByTestId("run-sweep").click();
  await expect(page.locator("table")).toBeVisible({ timeout: 90_000 });
  await page.locator("table tbody button").nth(4).click();
  await expect(page.getByText("mean m")).toBeVisible();
  expect(await contrastFailures(page)).toEqual([]);
});

test("nothing animates when the reader asks for reduced motion", async ({
  browser,
}) => {
  // The reduced-motion block used to enumerate animated classes by name, and
  // one of those selectors was wrong in a way that looked right --
  // `[class*="animate-[spin"]` matches Tailwind's arbitrary-value syntax, not
  // the plain `animate-spin` utility the code actually uses. The sweep page's
  // spinner ran at full speed for precisely the people who had asked it not
  // to. Nothing caught it, because no gate ever looked.
  //
  // This walks the routes with the preference set and asserts that *nothing*
  // is left running, rather than checking a list someone has to remember to
  // extend.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const moving = await page.evaluate(() =>
      Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const s = getComputedStyle(el);
          if (s.animationName === "none") return false;
          // Snapped to its end state (0.01ms, one iteration) counts as stopped.
          const ms =
            parseFloat(s.animationDuration) *
            (s.animationDuration.endsWith("ms") ? 1 : 1000);
          return ms > 1;
        })
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`)
        .slice(0, 5),
    );
    expect(moving, `still animating on ${route}`).toEqual([]);
  }

  // And the spinner specifically, since it only exists mid-run.
  await page.goto("/sweep");
  await page.getByRole("button", { name: "choppy" }).click();
  await page.getByTestId("run-sweep").click();
  const spinner = page.locator(".animate-spin").first();
  if (await spinner.isVisible().catch(() => false)) {
    const duration = await spinner.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    );
    expect(parseFloat(duration)).toBeLessThan(0.001);
  }
  await context.close();
});
