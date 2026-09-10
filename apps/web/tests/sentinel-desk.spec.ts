import { expect, test } from "@playwright/test";

test("sentinel: runs the catalogue and shows real verdicts, not placeholders", async ({ page }) => {
  await page.goto("/sentinel");

  // The suite auto-runs on arrival; a verdict pill proves the engine really ran.
  await expect(page.getByTestId("verdict-held").first()).toBeVisible({ timeout: 20_000 });

  const summary = page.getByText(/held ·.*cheap ·.*broken/);
  await expect(summary).toBeVisible();
  await expect(summary).not.toContainText("0 held");
  // Nothing in the shipped catalogue may be broken.
  await expect(summary).toContainText("0 broken");
});

test("sentinel: a cheap finding shows its note and never reads as broken", async ({ page }) => {
  await page.goto("/sentinel");
  await expect(page.getByTestId("verdict-held").first()).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("attack-A14_spot_oracle_toy").click();
  await expect(page.getByTestId("cheap-note")).toBeVisible();
  await expect(page.getByTestId("cheap-note")).toContainText("Placeholder oracle");
});

test("sentinel: replay in lab loads the attack's after-world into the live sim", async ({ page }) => {
  await page.goto("/sentinel");
  await expect(page.getByTestId("verdict-held").first()).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("attack-A4_contraction_bait").click();
  await page.getByTestId("replay-in-lab").click();

  await page.waitForURL("**/lab?sentinel=A4_contraction_bait", { timeout: 15_000 });

  // The demo world is itself several epochs in, so "epoch > 0" would pass
  // whether or not the replay landed. A4 seeds 50 genesis charters; the demo
  // world seeds 200, so the charter count is what actually distinguishes the
  // attack's after-world from the one that was already loaded.
  await expect(page.getByTestId("replay-banner")).toContainText("A4_contraction_bait");
  await expect(page.locator("body")).toContainText("50 live / 50 total");
  await expect(page.locator("body")).toContainText(/epoch\s*[1-9]/);
});

test("sentinel: the replay link survives a reload and can be shared", async ({ page }) => {
  // The whole point of putting the attack in the URL. This used to fail: the
  // Sentinel page applied the world itself and only then navigated, so the
  // parameter was decorative and a reload dropped you back on the demo world
  // with the URL still naming an attack.
  await page.goto("/lab?sentinel=A4_contraction_bait");

  await expect(page.getByTestId("replay-banner")).toContainText("A4_contraction_bait");
  await expect(page.locator("body")).toContainText("50 live / 50 total");

  await page.reload();
  await expect(page.getByTestId("replay-banner")).toContainText("A4_contraction_bait");
  await expect(page.locator("body")).toContainText("50 live / 50 total");
});

test("lab: an unknown attack id surfaces an error rather than failing silently", async ({ page }) => {
  await page.goto("/lab?sentinel=A99_does_not_exist");
  await expect(page.getByTestId("error-toast")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("replay-banner")).toHaveCount(0);
});

test("sentinel: a return visit reuses the run instead of recomputing it", async ({ page }) => {
  // Spec 8.2 asks for an auto-run on the *first* visit. This used to re-run the
  // whole catalogue on every mount and every reload, which is pure waste
  // because verdicts are deterministic -- and it made the page an expensive,
  // moving target for the wiring audit, which reloads before every control.
  await page.goto("/sentinel");
  await expect(page.getByTestId("last-run")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("verdict-held").first()).toBeVisible();

  await page.reload();

  // Verdicts are there immediately, from cache...
  await expect(page.getByTestId("verdict-held").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/0 broken/)).toBeVisible();
  // ...and nothing ran to produce them, so there is no run to report.
  await expect(page.getByTestId("last-run")).toHaveCount(0);

  // Pressing Run all still genuinely re-runs.
  await page.getByTestId("run-all").click();
  await expect(page.getByTestId("last-run")).toContainText("run #1", { timeout: 20_000 });
});

test("sentinel: a changed fixture invalidates the cached run", async ({ page }) => {
  // The auto-run is suppressed for the rest of the session once a run exceeds
  // 2s (spec 8.2, "otherwise require one click"). Clearing that keeps this
  // test about the cache key.
  await page.addInitScript(() => {
    try {
      sessionStorage.removeItem("sentinel:slow");
    } catch {
      // Storage unavailable is the same as no flag set.
    }
  });

  // Registered before the first load and toggled between the two. Adding it
  // just before the reload did not work: the browser served the fixture from
  // its own HTTP cache, so no request was issued for Playwright to intercept.
  // no-store keeps the second load going to the network.
  let modified = false;
  await page.route("**/attacks/A1_wash_volume.json", async (route) => {
    const body = await (await route.fetch()).json();
    // A wash epoch closes contraction. Demanding "expansion" is a claim the
    // engine will refuse, so the verdict must flip held -> broken.
    if (modified) body.expect = { ...body.expect, regimeAfter: "expansion" };
    await route.fulfill({ json: body, headers: { "cache-control": "no-store" } });
  });

  const a1 = page.getByTestId("attack-A1_wash_volume");

  await page.goto("/sentinel");
  // Wait for the run to *finish*, not merely for A1's pill to appear.
  //
  // A1 is the first attack computed, so its pill lands about thirty
  // milliseconds in while the other thirteen are still going -- and the cache
  // is only written once the whole run completes. Reloading on the pill left
  // nothing cached at all, so the reload re-ran from scratch, A1 came back
  // broken, and the test passed without the cache key ever being consulted.
  // It passed just as happily with the key replaced by a constant.
  await expect(page.getByTestId("last-run")).toBeVisible({ timeout: 45_000 });
  await expect(a1.getByTestId("verdict-held")).toBeVisible();

  modified = true;
  await page.reload();

  // Assert the *outcome*, not whether a run indicator appeared: a stale cache
  // would still show A1 as held, because that is the verdict it stored. Only a
  // correctly keyed cache misses, replays the changed fixture, and reports the
  // expectation it now fails.
  await expect(a1.getByTestId("verdict-broken")).toBeVisible({ timeout: 45_000 });
});

test("desk: the flip number is the loudest thing on the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/desk");

  const flip = page.getByTestId("flip-eth");
  await expect(flip).toBeVisible();

  // "Cannot be missed at 1280px" — hold that to something measurable.
  const size = await flip.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(44);

  await expect(page.getByTestId("flip-regime-now")).toBeVisible();
  await expect(page.getByTestId("flip-regime-live")).toBeVisible();
});

test("desk: the licence solver always offers three priced plans", async ({ page }) => {
  await page.goto("/desk");

  await expect(page.getByTestId("license-solver")).toBeVisible();
  for (const kind of ["now", "wait", "floor"]) {
    await expect(page.getByTestId(`plan-${kind}`)).toBeVisible();
  }
  await expect(page.getByTestId("license-solver").locator("tbody tr")).toHaveCount(3);
});

test("desk: a closed charter book shows a tombstone, never a tradable price", async ({ page }) => {
  await page.goto("/desk");

  await expect(page.getByTestId("charter-tombstone")).toBeVisible();
  await expect(page.getByTestId("charter-tombstone")).toContainText("unopened");
  await expect(page.getByTestId("charter-price")).toHaveCount(0);
});

test("desk: committing a swap prints to the shared tape", async ({ page }) => {
  await page.goto("/desk");

  const before = await page.getByTestId("flip-eth").innerText();
  await page.getByTestId("desk-commit-buy").click();

  // The flip quote must move, and the print must appear on the tape.
  await expect(page.getByTestId("flip-eth")).not.toHaveText(before);
  await expect(page.locator("td", { hasText: "buyStd" }).first()).toBeVisible();
});

test("desk: the crowd slider quotes a worse exit without touching live state", async ({ page }) => {
  await page.goto("/desk");
  await expect(page.getByTestId("exit-fee-now")).toBeVisible();

  const feeBefore = await page.getByTestId("exit-fee-now").innerText();
  await page.getByLabel("others retiring this week").fill("80");

  await expect(page.getByTestId("exit-fee-crowded")).not.toHaveText(feeBefore);
  // The live quote is unchanged: the slider only ever priced a clone.
  await expect(page.getByTestId("exit-fee-now")).toHaveText(feeBefore);
});
