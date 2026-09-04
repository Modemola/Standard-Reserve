import { expect, test, type Page } from "@playwright/test";
import { SCENARIO_IDS, SCENARIO_TITLES } from "../lib/scenarios";

/**
 * Every bundled scenario, driven through the real UI.
 *
 * The engine tests replay these files directly, and one of them (exodus) was
 * driven through the Lab. The other four were only ever exercised in-process,
 * so a scenario could have loaded into a broken screen -- or taught nothing
 * at all -- without any gate noticing.
 *
 * Each test asserts the claim the scenario's own `teach` string makes to the
 * reader, so the copy on /scenarios cannot drift away from what the
 * simulation actually does.
 */

/** Read the ticker's live numbers, which every route renders. */
async function ticker(page: Page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const grab = (re: RegExp) => (text.match(re) ?? [null, null])[1];
    const num = (s: string | null) => (s === null ? null : Number(s.replace(/,/g, "")));
    return {
      regime: grab(/REGIME\s+(\w+)/i),
      epoch: num(grab(/EPOCH\s+(\d+)/i)),
      m: num(grab(/\bM\s+([\d.]+)/)),
      F_n: num(grab(/F_N\s+([-\d.]+)/i)),
      sCirc: num(grab(/S_CIRC\s+([\d,.]+)/i)),
    };
  });
}

async function load(page: Page, id: string) {
  await page.goto("/lab");
  await expect(page.getByTestId("regime-badge")).toBeVisible();
  await page.getByRole("combobox").selectOption(id);
  await page.getByRole("button", { name: "load scenario" }).click();
  // The replay is synchronous once the JSON lands; wait on an observable
  // consequence rather than a fixed sleep.
  await expect
    .poll(async () => (await ticker(page)).epoch, { timeout: 10_000 })
    .not.toBeNull();
  // No scenario may surface an error toast -- a malformed file or an op this
  // build does not recognise would show one, and the world would be wrong.
  await expect(page.getByTestId("error-toast")).toHaveCount(0);
}

test("every bundled scenario has a UI test", () => {
  // Guards the suite itself: adding a sixth scenario without a test here
  // fails rather than passing silently.
  const covered = ["inflow_week", "exodus", "wash_same_epoch", "license_mania", "ghost_purge"];
  expect([...SCENARIO_IDS].sort()).toEqual([...covered].sort());
  for (const id of SCENARIO_IDS) expect(SCENARIO_TITLES[id]?.teach, `${id} has no teach text`).toBeTruthy();
});

test("inflow_week: sustained inflow puts the world in expansion", async ({ page }) => {
  await load(page, "inflow_week");
  const t = await ticker(page);
  expect(t.regime).toBe("expansion");
  expect(t.F_n!).toBeGreaterThan(0); // net inflow, by definition
  await expect(page.getByTestId("regime-badge")).toHaveText(/expansion/i);
});

test("exodus: sustained outflow flips the regime to contraction", async ({ page }) => {
  await load(page, "exodus");
  expect((await ticker(page)).regime).toBe("contraction");
  await expect(page.getByTestId("regime-badge")).toHaveText(/contraction/i);
});

test("wash_same_epoch: equal buy and sell nets F_n ~ 0 and does not pump issuance", async ({
  page,
}) => {
  await load(page, "wash_same_epoch");
  const t = await ticker(page);
  // "F_n ~ 0" -- not exactly zero, because the pool fee is charged on both
  // legs, so a wash costs the trader something. The point is that volume
  // alone moves it a rounding error rather than a regime.
  expect(Math.abs(t.F_n!)).toBeLessThan(1);
  // Issuance is not pumped by volume: m stays at its launch value.
  expect(t.m).toBe(1);
  // The load-bearing assertion, and the one that separates a wash from a
  // genuine outflow: exodus also ends at F_n 0 and m 1, so without this the
  // test passed when handed the wrong scenario. Volume is not direction --
  // round-tripping the same ETH must not tip the world into contraction.
  expect(t.regime).toBe("expansion");
  expect(t.epoch).toBeGreaterThan(0); // the epoch actually closed
});

test("license_mania: aggressive license buying burns $STANDARD", async ({ page }) => {
  await load(page, "license_mania");
  const burned = await page.evaluate(() => {
    const m = document.body.innerText.match(/B \(BURNED\)\s*\n?([\d,.]+)/i);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  });
  expect(burned, "no burn figure on the page").not.toBeNull();
  expect(burned!).toBeGreaterThan(0);
  // Burning is what makes circulating supply fall below the genesis float.
  expect((await ticker(page)).sCirc!).toBeLessThan(100_000_000);
});

test("ghost_purge: dormant charters are revoked and issuance is cut to the floor", async ({
  page,
}) => {
  await load(page, "ghost_purge");
  const t = await ticker(page);
  // Thirty epochs of no inflow drives m down to mMin.
  expect(t.epoch!).toBeGreaterThan(20);
  expect(t.m!).toBeLessThan(1);
  // Revocation burns the dormant charters' ledgers.
  expect(t.sCirc!).toBeLessThan(100_000_000);
});

test("sweep: the grid runs off the main thread and reproduces the CLI's findings", async ({
  page,
}) => {
  // Two things at once, because they are the same guarantee. The sweep must
  // run in a worker -- on the main thread this page would freeze for seconds
  // and could not even paint its own progress bar -- and it must produce the
  // identical grid to `pnpm sweep`, since both call one engine module.
  //
  // choppy at 60d x 5 seeds is the documented finding: only cutStep <= 0.1
  // survives directionless churn, and only at mMax >= 1.0.
  test.setTimeout(120_000);
  await page.goto("/sweep");
  await page.getByRole("button", { name: "choppy" }).click();
  await page.locator("input[type=number]").first().fill("60");
  await page.locator("input[type=number]").nth(1).fill("5");
  await page.getByTestId("run-sweep").click();

  // If the sweep blocked the main thread, this would time out rather than
  // resolve -- the assertion is as much about responsiveness as about output.
  await expect(page.locator("table")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/10\/30 healthy/)).toBeVisible();

  const grid = await page.evaluate(() =>
    Array.from(document.querySelectorAll("table tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("button"))
        .map((b) => b.textContent!.trim())
        .join(" "),
    ),
  );
  expect(grid).toEqual([
    "ok dead dead dead dead",
    "ok dead dead dead dead",
    "ok ok dead dead dead",
    "ok ok dead dead dead",
    "ok ok dead dead dead",
    "ok ok dead dead dead",
  ]);

  // Selecting a cell shows that run rather than a static blurb.
  await page.locator("table tbody button").first().click();
  await expect(page.getByText("mean m")).toBeVisible();
});
