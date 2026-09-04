"use client";

import { useEffect, useState } from "react";
import { useWorld } from "@/lib/sim-context";

// Every world.lastError value the engine can set (packages/engine/src:
// auctions.ts, exits.ts, dormancy.ts, store.ts), in the app's own voice,
// plus a couple of app-level codes (not from the engine) that reuse this
// same lastError -> toast path for consistency rather than inventing a
// second error-display mechanism.
const MESSAGES: Record<string, string> = {
  unknown_charter: "That charter doesn't exist in this simulation.",
  unknown_branch: "That branch isn't live.",
  per_charter_daily_cap: "This charter has already bought its 3 licenses for today.",
  daily_cap_reached: "Today's auction is sold out.",
  max_branches: "This charter already has all 10 branches open.",
  auctions_closed: "Charter auctions are closed today (charterDailyCap is 0).",
  not_yet_dormant: "This charter hasn't been idle long enough to report yet.",
  insufficient_payment: "That payment is below the current auction price.",
  "amount must be positive": "Enter an amount greater than zero.",
  // App-level, not from the engine (see lab/page.tsx loadScenarioById).
  scenario_load_failed: "Couldn't load that scenario. Check your connection and try again.",
  scenario_unknown_op: "That scenario contains a step this build doesn't recognise — it may be out of date.",
  tick_truncated: "That jump was too far to simulate in one step — the clock advanced as far as it could.",
};

function humanize(code: string): string {
  return MESSAGES[code] ?? `Action rejected: ${code}`;
}

/** Surfaces world.lastError as a transient toast. Every rejected action
 * (daily caps, insufficient payment, unknown charter, ...) sets lastError,
 * but until this component nothing displayed it — buttons appeared to do
 * nothing on failure. */
export function ErrorToast() {
  const world = useWorld();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!world.lastError) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
    // `world` (not just world.lastError) is the dependency: a fresh World
    // object is produced on every store.apply(), so this resets the
    // dismiss timer even when the same action fails twice in a row with
    // an identical error string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  if (!world.lastError || !visible) return null;

  return (
    <div
      data-testid="error-toast"
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-contraction/40 bg-ink px-4 py-2 text-sm text-contraction shadow-lg"
    >
      {humanize(world.lastError)}
    </div>
  );
}
