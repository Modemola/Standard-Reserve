import { expect, test, type Page } from "@playwright/test";

/**
 * "I press something and nothing happens."
 *
 * This clicks *every* control on every route and asserts the page observably
 * responds. It is the gate for the one bug class that no other test here can
 * catch: a button whose handler was never attached, or was attached to a
 * no-op, still renders perfectly and still passes a type check, a build, a
 * lint and every flow-specific e2e test that does not happen to press it.
 *
 * "Responds" means the URL, the visible text, or an aria state changed. A
 * control that changes none of those did nothing the user can perceive,
 * whatever it did internally.
 *
 * Interactions go through Playwright's real event simulation rather than
 * assigning to `.value`: React installs its own value setter on inputs, so a
 * direct assignment updates the DOM without ever reaching onChange. An audit
 * written that way reports working sliders as dead — this one did, before it
 * was fixed.
 */

const ROUTES = ["/", "/lab", "/bank/c-0042", "/desk", "/sweep", "/sentinel", "/scenarios", "/law"];

/**
 * Controls that legitimately change nothing on the current page. Each is
 * asserted separately below rather than merely skipped, so "inert" can never
 * quietly become "broken".
 */
const INERT = [
  /Modeling The Standard Reserve/, // opens a new tab
  /^steady_inflow$/, // already the selected market on first paint
  // Sets params.charterDailyCap to whatever the field holds. The field
  // defaults to the current value (0), so pressing it unchanged is genuinely
  // a no-op. Proven to work with a real value in "the Lab's world controls
  // reach the engine" below.
  /^force charterDailyCap$/,
  // Triggers a file download; there is nothing for the page to change.
  // Asserted to produce world-epoch-N.txt in that same test.
  /^export world JSON$/,
  // Same shape: writes <id>.verdict.json and leaves the page alone. Asserted
  // to actually produce the file in "Sentinel's inert controls" below.
  /^Download verdict\.json$/,
  // The attack selected on first paint. Selecting the row that is already
  // selected is genuinely a no-op; selecting any other row swaps the detail
  // pane, which is asserted below.
  /^A1_wash_volume/,
];

const isInert = (label: string) => INERT.some((re) => re.test(label));

const fingerprint = (page: Page) =>
  page.evaluate(() => {
    const aria = Array.from(
      document.querySelectorAll("[aria-pressed],[aria-expanded],[aria-current],[disabled]"),
    )
      .map(
        (e) =>
          e.tagName +
          (e.getAttribute("aria-pressed") ?? "") +
          (e.getAttribute("aria-expanded") ?? "") +
          (e.getAttribute("aria-current") ?? "") +
          (e.hasAttribute("disabled") ? "d" : ""),
      )
      .join("|");
    return JSON.stringify({
      url: location.pathname + location.search,
      text: document.body.innerText,
      aria,
    });
  });

const CONTROLS = "main button, main a, main input[type=range], main select";

for (const route of ROUTES) {
  test(`every control on ${route} does something`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const total = await page.locator(CONTROLS).count();
    const dead: string[] = [];
    let exercised = 0;

    for (let i = 0; i < total; i++) {
      // Reload between controls so each is tested from the same clean state
      // and one interaction cannot mask the next.
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const el = page.locator(CONTROLS).nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;

      const tag = await el.evaluate((e) => e.tagName);
      const label = (
        (await el.textContent().catch(() => "")) ||
        (await el.getAttribute("aria-label").catch(() => "")) ||
        ""
      ).trim();

      if (await el.isDisabled().catch(() => false)) continue; // disabled on purpose
      if (isInert(label)) continue;

      const before = await fingerprint(page);
      if (tag === "SELECT") {
        // A select's own value is the observable, not the page text: choosing
        // a scenario stages it, and only "load scenario" applies it. Assert
        // the right thing rather than exempting the control.
        const count = await el.locator("option").count();
        if (count < 2) continue;
        const wasValue = await el.inputValue();
        await el.selectOption({ index: 1 });
        const nowValue = await el.inputValue();
        if (wasValue === nowValue) dead.push(`SELECT "${label.slice(0, 40)}" did not change value`);
        exercised += 1;
        continue;
      } else if (tag === "INPUT") {
        await el.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
      } else {
        await el.click({ timeout: 5000 });
      }
      await page.waitForTimeout(500);

      if ((await fingerprint(page)) === before) dead.push(`${tag} "${label.slice(0, 40)}"`);
      exercised += 1;
    }

    // Guards the guard: if nothing was exercised the assertion below is vacuous.
    if (route !== "/law") expect(exercised, `no controls found on ${route}`).toBeGreaterThan(0);
    expect(dead, `controls on ${route} that did nothing`).toEqual([]);
  });
}

test("the inert controls are inert for the reason claimed", async ({ page }) => {
  // The whitepaper link changes nothing on this page because it opens a new
  // tab — so assert that, rather than trusting the exemption.
  await page.goto("/");
  const link = page.locator('a[href*="standardreserve.xyz"]').first();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  await expect(link).toHaveAttribute("href", /^https:\/\//);

  // The default market button changes nothing because it is already selected.
  await page.goto("/sweep");
  await expect(page.getByRole("button", { name: "steady_inflow" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the Lab's world controls reach the engine, not just the DOM", async ({ page }) => {
  // Two controls that a fingerprint check can pass while still being broken,
  // because their effect is a download and a params mutation.
  await page.goto("/lab");
  await expect(page.getByTestId("regime-badge")).toBeVisible();

  // force charterDailyCap must actually change params and unlock the auction.
  await expect(page.getByRole("button", { name: /buy charter/i })).toBeDisabled();
  const capField = page.getByLabel(/charter daily cap/i).or(page.locator("input").nth(3));
  await capField.fill("7");
  await page.getByRole("button", { name: "force charterDailyCap" }).click();
  await expect(page.getByText(/daily cap 7/)).toBeVisible();
  await expect(page.getByRole("button", { name: /buy charter/i })).toBeEnabled();

  // export world JSON must produce a file, not fail silently.
  const download = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: /export world JSON/i }).click();
  expect((await download).suggestedFilename()).toMatch(/^world-epoch-\d+\.txt$/);
});

test("the what-if sliders move the preview and arm the commit", async ({ page }) => {
  await page.goto("/bank/c-0042");
  const commit = page.getByRole("button", { name: /Commit on live sim/i });
  await expect(commit).toBeDisabled(); // nothing staged yet

  const slider = page.locator("input[type=range]").first();
  await slider.focus();
  await page.keyboard.press("ArrowRight");

  await expect(slider).not.toHaveValue("0");
  await expect(commit).toBeEnabled();
});

test("Sentinel's inert controls are inert for the reason claimed", async ({ page }) => {
  await page.goto("/sentinel");
  await expect(page.getByTestId("verdict-held").first()).toBeVisible({ timeout: 20_000 });

  // "Download verdict.json" changes nothing on the page because it writes a file.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download verdict.json" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.verdict\.json$/);

  // The first row is inert only because it is already selected: any other row
  // must swap the detail pane.
  await expect(page.getByRole("heading", { level: 2 })).toContainText("A1_wash_volume");
  await page.getByTestId("attack-A8_exit_run").click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("A8_exit_run");
});

test("re-running the Sentinel suite is visible to the user", async ({ page }) => {
  await page.goto("/sentinel");
  await expect(page.getByTestId("last-run")).toBeVisible({ timeout: 20_000 });

  // Attacks are deterministic, so the verdicts are identical on a second run.
  // The run counter is what tells the user the button did anything at all.
  const first = await page.getByTestId("last-run").innerText();
  await page.getByTestId("run-all").click();
  await expect(page.getByTestId("last-run")).not.toHaveText(first, { timeout: 20_000 });
  await expect(page.getByTestId("last-run")).toContainText("run #2");
});
