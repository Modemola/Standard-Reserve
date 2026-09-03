import { expect, test } from "@playwright/test";

test("lab: loading exodus flips the regime to contraction", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("combobox").selectOption("exodus");
  await page.getByRole("button", { name: "load scenario" }).click();
  await expect(page.getByTestId("regime-badge")).toHaveText(/contraction/i);
});

test("bank: buy a license, retire a branch, S_max falls", async ({ page }) => {
  await page.goto("/bank/c-0042");
  await expect(page.getByText(/No charter/)).toHaveCount(0);

  await page.getByRole("button", { name: /^\+/ }).first().click(); // buy license on the first empty slot

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
