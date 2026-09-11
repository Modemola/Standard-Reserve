import { expect, test } from "@playwright/test";

/**
 * The plain-language explainers.
 *
 * User testing said the build was unreadable to anyone who did not already
 * know the vocabulary. These assert the fix actually works, and pin two
 * defects that were found by opening the page and looking at it — neither of
 * which any existing gate could have caught, because contrast passed, nothing
 * overflowed, and every control responded.
 */

const TRIGGER = "[data-testid=explain-trigger]";
const PANEL = "[data-testid=explain-panel]";

test("a trigger opens a panel that explains the term in plain words", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.locator(PANEL)).toHaveCount(0);

  await page.locator(TRIGGER).first().click();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();

  // The panel says something, and says it in sentences rather than symbols.
  await expect(panel).toContainText("In plain English");
  await expect(panel.locator("h3")).not.toBeEmpty();
  const body = (await panel.innerText()).trim();
  expect(body.length).toBeGreaterThan(60);
});

test("the explanation is not rendered in capitals", async ({ page }) => {
  // Triggers sit inside uppercase, letter-spaced 11px labels, and
  // text-transform inherits. The first build rendered every explanation in
  // block capitals -- plain English set in caps, which is harder to read than
  // the jargon it was there to explain.
  await page.goto("/lab");
  await page.locator(TRIGGER).first().click();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();

  const transform = await panel
    .locator("h3")
    .evaluate((el) => getComputedStyle(el).textTransform);
  expect(transform).toBe("none");

  // And the heading really is mixed case, not merely permitted to be.
  const heading = (await panel.locator("h3").innerText()).trim();
  expect(heading).not.toBe(heading.toUpperCase());
});

test("the explanation is not rendered in bold", async ({ page }) => {
  // The Desk's card headings are font-semibold, and font-weight inherits too,
  // so the body copy of every explainer on that page came out bold. Same bug
  // class as the capitals above, found the same way -- by looking at it.
  await page.goto("/desk");
  await page.locator(TRIGGER).first().click();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();

  const weight = await panel
    .locator("p")
    .filter({ hasText: /./ })
    .last()
    .evaluate((el) => getComputedStyle(el).fontWeight);
  expect(Number(weight)).toBeLessThanOrEqual(400);
});

test("a label that was uppercase stays uppercase once it becomes a trigger", async ({ page }) => {
  // The other half of the same bug: form controls have their own
  // text-transform in the UA sheet, so turning a label into a button
  // silently dropped its casing while the labels beside it kept theirs.
  await page.goto("/lab");
  const termTrigger = page.locator(`${TRIGGER}:not(:has(span[aria-hidden]))`).first();
  await expect(termTrigger).toBeVisible();
  const transform = await termTrigger.evaluate((el) => getComputedStyle(el).textTransform);
  expect(transform).toBe("uppercase");
});

test("Escape closes it and hands focus back to the trigger", async ({ page }) => {
  await page.goto("/lab");
  const trigger = page.locator(TRIGGER).first();
  await trigger.click();
  await expect(page.locator(PANEL)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(PANEL)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("only one explainer is open at a time", async ({ page }) => {
  await page.goto("/lab");
  await page.locator(TRIGGER).nth(0).click();
  await expect(page.locator(PANEL)).toHaveCount(1);

  await page.locator(TRIGGER).nth(3).click();
  // The first is dismissed rather than stacking a second panel over it.
  await expect(page.locator(PANEL)).toHaveCount(1);
});

test("the panel stays inside the viewport, wherever its trigger sits", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/lab");
  // count() does not auto-wait, and the Lab renders its world after hydration,
  // so counting straight after goto reliably counts zero.
  await expect(page.locator(TRIGGER).first()).toBeVisible();

  const count = await page.locator(TRIGGER).count();
  expect(count).toBeGreaterThan(3);

  for (let i = 0; i < count; i++) {
    await page.locator(TRIGGER).nth(i).click();
    // A closing panel stays mounted for its exit animation, so measure only
    // once the previous one has actually gone.
    await expect(page.locator(PANEL)).toHaveCount(1);
    const box = await page.locator(PANEL).boundingBox();
    if (!box) continue;
    expect(box.x, `panel ${i} runs off the left`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `panel ${i} runs off the right`).toBeLessThanOrEqual(1281);
    expect(box.y, `panel ${i} runs off the top`).toBeGreaterThanOrEqual(-1);
    await page.keyboard.press("Escape");
    await expect(page.locator(PANEL)).toHaveCount(0);
  }

  // Nothing it did pushed the page sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("on a phone it becomes a bottom sheet with a scrim and a way out", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bank/c-0042");

  await page.locator(TRIGGER).first().click();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();

  // Anchored to the bottom rather than floating beside a trigger there is no
  // room for, and wide enough to actually read.
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeGreaterThan(300);
  expect(box.y + box.height).toBeGreaterThan(600);

  await expect(panel.getByRole("button", { name: "Got it" })).toBeVisible();
  await panel.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator(PANEL)).toHaveCount(0);
});

test("every route offers at least one explanation", async ({ page }) => {
  // The point of the exercise was that no page should be a wall of jargon
  // with nothing to click. A route that has none has been missed.
  for (const route of ["/lab", "/bank/c-0042", "/desk", "/sentinel", "/sweep", "/scenarios"]) {
    await page.goto(route);
    await expect(page.locator(TRIGGER).first(), `${route} has no explainers`).toBeVisible();
  }
});
