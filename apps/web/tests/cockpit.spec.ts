import { expect, test } from "@playwright/test";

test("lab: loading exodus flips the regime to contraction", async ({ page }) => {
  await page.goto("/lab");
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
