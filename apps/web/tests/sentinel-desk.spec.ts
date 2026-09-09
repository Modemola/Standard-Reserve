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
