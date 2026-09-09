// quoteLicense().yourRemainingToday used to be the constant
// maxLicensesPerCharterPerDay: it read "3 left" however many had been bought.
// Nothing noticed, because the cockpit -- the only thing that needed the
// number -- derived its own correctly and never read the field.
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@standard-law/params";
import {
  buyLicense,
  createWorld,
  licensesRemainingToday,
  quoteLicense,
  seedGenesis,
  tick,
} from "../src/index.js";

const seeded = () => seedGenesis(createWorld(DEFAULT_PARAMS, 0), 10);

describe("quoteLicense.yourRemainingToday", () => {
  it("counts down as the charter buys", () => {
    let w = seeded();
    const cap = DEFAULT_PARAMS.maxLicensesPerCharterPerDay;
    expect(quoteLicense(w, "c-0001").yourRemainingToday).toBe(cap);

    for (let bought = 1; bought <= cap; bought++) {
      w = buyLicense(w, "c-0001");
      expect(w.lastError).toBeUndefined();
      expect(quoteLicense(w, "c-0001").yourRemainingToday).toBe(cap - bought);
    }
    expect(quoteLicense(w, "c-0001").yourRemainingToday).toBe(0);
  });

  it("is per charter, not global", () => {
    let w = seeded();
    w = buyLicense(w, "c-0001");
    expect(quoteLicense(w, "c-0001").yourRemainingToday).toBe(
      DEFAULT_PARAMS.maxLicensesPerCharterPerDay - 1,
    );
    expect(quoteLicense(w, "c-0002").yourRemainingToday).toBe(
      DEFAULT_PARAMS.maxLicensesPerCharterPerDay,
    );
  });

  it("refills when the day rolls over", () => {
    let w = seeded();
    for (let i = 0; i < DEFAULT_PARAMS.maxLicensesPerCharterPerDay; i++) {
      w = buyLicense(w, "c-0001");
    }
    expect(quoteLicense(w, "c-0001").yourRemainingToday).toBe(0);

    w = tick(w, 86_400);
    expect(quoteLicense(w, "c-0001").yourRemainingToday).toBe(
      DEFAULT_PARAMS.maxLicensesPerCharterPerDay,
    );
  });

  it("agrees with what the engine will actually allow", () => {
    let w = seeded();
    // Buy until the quote says none remain, then confirm the engine refuses.
    while (quoteLicense(w, "c-0001").yourRemainingToday > 0) {
      w = buyLicense(w, "c-0001");
      expect(w.lastError).toBeUndefined();
    }
    w = buyLicense(w, "c-0001");
    expect(w.lastError).toBe("per_charter_daily_cap");
  });

  it("reports nothing left for a charter that is gone, and the cap with no charter named", () => {
    const w = seeded();
    expect(licensesRemainingToday(w, "c-9999")).toBe(0);
    expect(quoteLicense(w).yourRemainingToday).toBe(DEFAULT_PARAMS.maxLicensesPerCharterPerDay);
  });
});
