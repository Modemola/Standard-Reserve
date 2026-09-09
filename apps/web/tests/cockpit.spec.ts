import { expect, test } from "@playwright/test";

test("lab: loading exodus flips the regime to contraction", async ({ page }) => {
  await page.goto("/lab");

  // Assert the *starting* state first. Without this the test was vacuous: the
  // demo world's last closed epoch had F_n = 0, which is contraction by spec,
  // so "flips to contraction" asserted something that was already true and
  // would have passed even if the scenario loader did nothing at all. This is
  // the Phase B exit criterion, so it needs to actually exercise the flip.
  await expect(page.getByTestId("regime-badge")).toHaveText(/expansion/i);

  await page.getByRole("combobox").selectOption("exodus");
  await page.getByRole("button", { name: "load scenario" }).click();
  await expect(page.getByTestId("regime-badge")).toHaveText(/contraction/i);
});

test("lab: the constants drawer surfaces unpublished-placeholder params (§0 non-goal: don't hide them)", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(page.getByText("unpublished_placeholder")).toHaveCount(0);

  await page.getByRole("button", { name: /show constants/ }).click();
  await expect(page.getByText("unpublished_placeholder").first()).toBeVisible();
});

test("bank: buy a license, retire a branch, S_max falls", async ({ page }) => {
  await page.goto("/bank/c-0042");
  await expect(page.getByText(/No charter/)).toHaveCount(0);

  await page.getByRole("button", { name: /Buy license for empty branch slot/ }).first().click();

  await page.getByRole("link", { name: "Lab" }).click();
  await page.waitForURL("**/lab");
  const sMaxBefore = await page.getByTestId("s-max").innerText();

  await page.getByRole("link", { name: "Bank" }).click();
  await page.waitForURL("**/bank/**");
  await page.getByRole("button", { name: "retire branch" }).first().click();
  await page.getByRole("button", { name: "Confirm retire" }).click();

  await page.getByRole("link", { name: "Lab" }).click();
  await page.waitForURL("**/lab");
  const sMaxAfter = await page.getByTestId("s-max").innerText();

  expect(sMaxAfter).not.toEqual(sMaxBefore);
});

test("bank: what-if preview does not touch live state until committed", async ({ page }) => {
  await page.goto("/bank/c-0042");

  await page.getByRole("link", { name: "Lab" }).click();
  await page.waitForURL("**/lab");
  const sMaxBefore = await page.getByTestId("s-max").innerText();

  await page.getByRole("link", { name: "Bank" }).click();
  await page.waitForURL("**/bank/**");

  const slider = page.getByRole("slider", { name: /Licenses to buy today/ });
  const previewBefore = await page.getByTestId("whatif-s-max-preview").innerText();
  await slider.focus();
  await slider.press("ArrowRight"); // bump the hypothetical to 1 license

  // The preview recomputes locally...
  const previewAfter = await page.getByTestId("whatif-s-max-preview").innerText();
  expect(previewAfter).not.toEqual(previewBefore);

  // ...but the live simulation must be untouched by merely moving the slider.
  await page.getByRole("link", { name: "Lab" }).click();
  await page.waitForURL("**/lab");
  const sMaxStillUnchanged = await page.getByTestId("s-max").innerText();
  expect(sMaxStillUnchanged).toEqual(sMaxBefore);

  // Only committing should mutate the live world.
  await page.getByRole("link", { name: "Bank" }).click();
  await page.waitForURL("**/bank/**");
  await page.getByRole("slider", { name: /Licenses to buy today/ }).focus();
  await page.getByRole("slider", { name: /Licenses to buy today/ }).press("ArrowRight");
  await page.getByRole("button", { name: "Commit on live sim" }).click();

  await page.getByRole("link", { name: "Lab" }).click();
  await page.waitForURL("**/lab");
  const sMaxAfterCommit = await page.getByTestId("s-max").innerText();
  expect(sMaxAfterCommit).not.toEqual(sMaxBefore);
});

test("lab: a rejected action surfaces an error toast instead of failing silently", async ({ page }) => {
  await page.goto("/lab");

  await expect(page.getByTestId("error-toast")).toHaveCount(0);

  // parseAmount("") -> 0n -> applySwap rejects with "amount must be positive".
  await page.getByLabel("ETH to spend buying STD").fill("");
  await page.getByRole("button", { name: "buy STD (ETH)" }).click();

  const toast = page.getByTestId("error-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("Enter an amount greater than zero.");
});

test("lab: buy charter opens a charter auction slot, only when charterDailyCap is open", async ({ page }) => {
  await page.goto("/lab");

  const buyBtn = page.getByRole("button", { name: /buy charter/ });
  await expect(buyBtn).toBeDisabled(); // charterDailyCap is 0 by default

  await page.getByLabel("New charterDailyCap value").fill("5");
  await page.getByRole("button", { name: "force charterDailyCap" }).click();
  await expect(buyBtn).toBeEnabled();

  await page.getByLabel("New charter owner key").fill("test-owner-1");
  await buyBtn.click();
  await expect(page.getByTestId("error-toast")).toHaveCount(0);

  await page.getByRole("link", { name: "Bank" }).click();
  await page.waitForURL("**/bank/**");
  await expect(page.getByText("1/5 sold")).toBeVisible();
});

test("lab: report dormant rejects an active charter, succeeds once truly dormant", async ({ page }) => {
  await page.goto("/lab");

  const reportBtn = page.getByRole("button", { name: "report dormant" });
  await expect(page.getByLabel("Charter id to report dormant")).toHaveValue("c-0042");

  // c-0042 was just interacted with by the demo seed -> not yet dormant.
  await reportBtn.click();
  await expect(page.getByTestId("error-toast")).toHaveText(
    "This charter hasn't been idle long enough to report yet.",
  );

  // dormancySeconds is 30 days; 31 daily ticks clears it.
  const dayBtn = page.getByRole("button", { name: "+1 day" });
  for (let i = 0; i < 31; i++) await dayBtn.click();

  await reportBtn.click();
  await expect(page.getByTestId("error-toast")).toHaveCount(0);
});

test("lab: a failed scenario fetch surfaces an error toast instead of doing nothing", async ({ page }) => {
  await page.goto("/lab");

  await page.route("**/scenarios/*.json", (route) => route.abort("failed"));
  await page.getByRole("combobox").selectOption("inflow_week");
  await page.getByRole("button", { name: "load scenario" }).click();

  await expect(page.getByTestId("error-toast")).toHaveText(
    "Couldn't load that scenario. Check your connection and try again.",
  );
});
