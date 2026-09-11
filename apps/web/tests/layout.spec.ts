import { expect, test } from "@playwright/test";

/**
 * Visual-correctness guards for things a screenshot review catches but no
 * other gate does. Both of these were real defects found by looking at the
 * app in expansion regime, which had never been reviewed directly -- every
 * previous screenshot happened to be mid-contraction.
 */

const EXPANSION = "rgb(201, 162, 39)"; // #C9A227
const CONTRACTION = "rgb(220, 85, 70)"; // #DC5546

/** Drive the world into expansion. inflow_week is the net-inflow scenario. */
async function loadExpansion(page: import("@playwright/test").Page) {
  await page.goto("/lab");
  await page.getByRole("combobox").selectOption("inflow_week");
  await page.getByRole("button", { name: "load scenario" }).click();
  await expect(page.getByTestId("regime-badge")).toHaveText(/expansion/i);
}

for (const width of [1024, 1280, 1440]) {
  test(`stat values share a baseline within each row at ${width}px`, async ({ page }) => {
    // Two of the Lab's four telemetry labels ("net flow (this epoch)",
    // "F_n (last epoch)") wrap to two lines while "signal" and "m" do not, so
    // their values sat 20px lower than their neighbours' at every width. The
    // labels now reserve two lines whether or not they use them.
    await page.setViewportSize({ width, height: 1200 });

    for (const [route, selector] of [
      ["/lab", "section .grid.grid-cols-2"],
      ["/bank/c-0042", ".grid.grid-cols-2"],
    ] as const) {
      await page.goto(route);
      // Wait for a hydrated anchor before reading geometry. /lab renders
      // behind <Suspense>, so goto() resolves while the grid does not yet
      // exist and a raw evaluate() -- which does not retry -- reads nothing.
      await expect(page.locator(selector).first()).toBeVisible();
      const offenders = await page.evaluate((sel) => {
        const grid = document.querySelector(sel);
        if (!grid) return ["grid not found"];
        // Group cells by their own top edge: cells on one row must put their
        // value on one baseline. Grouping by row is what makes this work for
        // a six-stat grid that legitimately wraps.
        const rows = new Map<number, { label: string; top: number }[]>();
        for (const cell of Array.from(grid.children)) {
          const ps = cell.querySelectorAll("p");
          if (ps.length < 2) continue;
          const key = Math.round(cell.getBoundingClientRect().top);
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key)!.push({
            label: ps[0].textContent!.trim(),
            top: Math.round(ps[1].getBoundingClientRect().top),
          });
        }
        const bad: string[] = [];
        for (const [rowTop, cells] of rows) {
          if (new Set(cells.map((c) => c.top)).size > 1)
            bad.push(`row@${rowTop}: ${cells.map((c) => `${c.label}=${c.top}`).join(", ")}`);
        }
        return bad;
      }, selector);
      expect(offenders, `misaligned stat values on ${route}`).toEqual([]);
    }
  });
}

test("both regimes paint their own colour, everywhere", async ({ page }) => {
  // The palette forked once already: lifting the contraction red for contrast
  // updated the Tailwind class but not the copies pasted into SVG stroke
  // attributes and recharts props, so the Lab's rosette, a sparkline and
  // every chart kept drawing the old failing #C0392B. The contrast gate reads
  // text colours, so it saw nothing. This reads the painted values.
  const tickerRegime = () =>
    page.evaluate(() => {
      for (const cell of Array.from(document.querySelectorAll("div.font-mono span"))) {
        const spans = cell.querySelectorAll("span");
        if (spans.length && spans[0].textContent!.trim() === "regime") {
          const v = spans[1] ?? cell.lastElementChild!;
          return { text: v.textContent!.trim(), color: getComputedStyle(v).color };
        }
      }
      return null;
    });

  // expect.poll, not a one-shot read: FlashOnChange briefly brightens a
  // value when it changes (the ticker flashed rgb(232,202,104) mid-animation),
  // so the assertion has to wait for the colour to settle rather than catch
  // the flash and call it a palette bug.
  // The demo world now opens in expansion, so contraction is reached by
  // loading exodus rather than by doing nothing.
  // Both halves of the palette, each asserted while its own regime is live.
  // 20s, not the 5s default. These polls wait on a scenario replaying through
  // the real engine in the browser, and the suite now also mounts /sentinel --
  // which runs all 14 attacks on arrival -- in parallel workers. That is real
  // CPU competing for the same cores, and it pushed this poll over 5s in full
  // runs while it passed 6/6 in isolation. Same call main made for
  // ghost_purge's loader: a budget set too close, not a defect.
  //
  // Raised again to 30s when the plain-language explainers landed. They add
  // roughly a dozen controls per route, and the wiring audit reloads the page
  // before every single control, so /lab's audit went from 26s to 53s. That is
  // more parallel work on the same cores: this poll timed out in one full run
  // and passed in the next, while passing in 9.8s on its own. A poll that
  // fails half the time is worse than no poll, and the contention it was
  // budgeted against has moved, so the budget moves with it.
  const REGIME_POLL = { timeout: 30_000 };

  await loadExpansion(page);
  await expect.poll(tickerRegime, REGIME_POLL).toEqual({ text: "expansion", color: EXPANSION });
  await expect(page.getByTestId("regime-badge")).toHaveCSS("color", EXPANSION);

  await page.getByRole("combobox").selectOption("exodus");
  await page.getByRole("button", { name: "load scenario" }).click();
  await expect(page.getByTestId("regime-badge")).toHaveText(/contraction/i);
  await expect.poll(tickerRegime, REGIME_POLL).toEqual({ text: "contraction", color: CONTRACTION });
  await expect(page.getByTestId("regime-badge")).toHaveCSS("color", CONTRACTION);

  // Charts must draw from the same palette, not their own copy of it.
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
  const chartColours = await page.evaluate(() =>
    [
      ...new Set(
        Array.from(document.querySelectorAll(".recharts-wrapper [stroke], .recharts-wrapper [fill]"))
          .flatMap((e) => [e.getAttribute("stroke"), e.getAttribute("fill")])
          .filter((c): c is string => !!c && c.startsWith("#")),
      ),
    ].sort(),
  );
  expect(chartColours.length, "no chart colours found -- charts did not render").toBeGreaterThan(0);
  for (const c of chartColours) expect(["#C9A227", "#DC5546"]).toContain(c);
});
