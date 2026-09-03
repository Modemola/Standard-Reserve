export const SCENARIO_IDS = [
  "inflow_week",
  "exodus",
  "wash_same_epoch",
  "license_mania",
  "ghost_purge",
] as const;

export const SCENARIO_TITLES: Record<string, { title: string; teach: string }> = {
  inflow_week: {
    title: "Inflow week",
    teach: "Sustained net ETH inflow raises m toward mMax and grows the expansion vault.",
  },
  exodus: {
    title: "Sustained ETH outflow",
    teach: "Fees flip this epoch; issuance cuts on close; exit fee rises.",
  },
  wash_same_epoch: {
    title: "Wash trade, same epoch",
    teach: "Equal buy+sell nets F_n ≈ 0 — contraction fee routing, issuance not pumped by volume.",
  },
  license_mania: {
    title: "License mania",
    teach: "Aggressive same-day license buying decays P(t) fast and burns $STANDARD into B.",
  },
  ghost_purge: {
    title: "Ghost purge",
    teach: "Never-checked-in charters cross dormancySeconds and get reported by a third party.",
  },
};

export async function fetchScenario(id: string) {
  const res = await fetch(`/scenarios/${id}.json`);
  if (!res.ok) throw new Error(`failed to load scenario ${id}`);
  return res.json();
}
