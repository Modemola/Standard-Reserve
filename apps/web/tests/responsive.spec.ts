import { expect, test, type Page } from "@playwright/test";

/**
 * Device gates.
 *
 * The app had been "checked at 1280px" and pronounced responsive. It was not:
 * the /law tables sat in an `overflow-hidden` wrapper 79px narrower than they
 * were, so on every phone the entire notes column was unreachable — no
 * scrollbar, nothing to drag, content simply gone. The earlier check missed it
 * because clipped content does not register as page overflow, which is the
 * only thing that check measured.
 *
 * So these test three different failure modes, not one:
 *   1. the page itself scrolls sideways,
 *   2. content is clipped by an ancestor that cannot scroll,
 *   3. controls are too small to hit with a thumb.
 */

const ROUTES = ["/", "/lab", "/bank/c-0042", "/desk", "/sweep", "/sentinel", "/scenarios", "/law"];

const DEVICES = [
  { w: 320, h: 568, name: "small phone" },
  { w: 390, h: 844, name: "modern phone" },
  { w: 768, h: 1024, name: "tablet portrait" },
  { w: 844, h: 390, name: "phone landscape" },
];

/** WCAG 2.5.8 Target Size (Minimum) is 24x24 CSS px. */
const MIN_TARGET = 24;

async function audit(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const clipped: string[] = [];
    const small: string[] = [];

    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;

      // (2) Content wider than an ancestor that cannot scroll is unreachable.
      // Walk up looking for who constrains it: a scrolling ancestor is fine,
      // a hidden one is a bug. Deliberately ignores decorative art, which is
      // meant to bleed past its frame.
      const decorative = el.closest('[aria-hidden="true"]') !== null;
      if (!decorative && box.width > 24) {
        let node: Element | null = el.parentElement;
        while (node) {
          const ps = getComputedStyle(node);
          const scrolls = ps.overflowX === "auto" || ps.overflowX === "scroll";
          const hides = ps.overflowX === "hidden" || ps.overflowX === "clip";
          if (scrolls) break;
          if (hides) {
            if (el.scrollWidth > node.clientWidth + 1)
              clipped.push(
                `${el.tagName}.${String(el.className).slice(0, 30)} (${Math.round(
                  el.scrollWidth,
                )}px inside ${node.clientWidth}px of ${node.tagName})`,
              );
            break;
          }
          node = node.parentElement;
        }
      }

      // (3) Touch targets.
      if (el.matches("a,button,input,select,textarea,[role=button]")) {
        if (box.width < 24 || box.height < 24)
          small.push(
            `${el.tagName}"${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 22)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
          );
      }
    }

    return {
      overflow: de.scrollWidth - vw, // (1)
      clipped: [...new Set(clipped)].slice(0, 5),
      small: [...new Set(small)].slice(0, 5),
    };
  });
}

for (const device of DEVICES) {
  for (const route of ROUTES) {
    test(`${device.name} (${device.w}px): ${route} fits, scrolls and can be tapped`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: device.w, height: device.h });
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const r = await audit(page);

      expect(r.overflow, `${route} scrolls sideways at ${device.w}px`).toBeLessThanOrEqual(0);
      expect(r.clipped, `${route} has unreachable clipped content at ${device.w}px`).toEqual([]);
      expect(
        r.small,
        `${route} has targets under ${MIN_TARGET}px at ${device.w}px`,
      ).toEqual([]);
    });
  }
}

test("the mobile menu opens, navigates and closes itself", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toggle = page.locator("header button").first();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  // The one control a phone user cannot do without: it must be thumb-sized.
  const box = await toggle.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.locator("header a[href='/law']").last().click();
  await expect(page).toHaveURL(/\/law$/);
  // It closes on navigation rather than covering the page it just opened.
  await expect(page.locator("header button").first()).toHaveAttribute("aria-expanded", "false");
});

test("wide tables stay reachable by scrolling on a phone", async ({ page }) => {
  // The specific regression: /law's tables in an overflow-hidden wrapper.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/law");

  const reachable = await page.evaluate(() => {
    const out: { overflowX: string; scrollable: boolean }[] = [];
    for (const t of Array.from(document.querySelectorAll("table"))) {
      const wrap = t.parentElement!;
      out.push({
        overflowX: getComputedStyle(wrap).overflowX,
        scrollable: wrap.scrollWidth > wrap.clientWidth,
      });
    }
    return out;
  });

  expect(reachable.length).toBeGreaterThan(0);
  for (const t of reachable) {
    // If it needs to scroll, it must be allowed to.
    if (t.scrollable) expect(["auto", "scroll"]).toContain(t.overflowX);
  }
});
