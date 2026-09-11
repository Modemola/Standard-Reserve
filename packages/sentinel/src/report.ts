// The verdict table. Designed to be dropped into a PR or an X DM without a
// narrated thread around it: id, what it attacks, what the engine did.
import type { Verdict } from "./schema.js";

const LABEL: Record<Verdict["status"], string> = {
  held: "HELD",
  cheap: "CHEAP",
  broken: "BROKEN",
  pending: "PENDING",
};

function summarize(v: Verdict): string {
  if (v.broken.length > 0) return v.broken.join("; ");
  if (v.unexpected.length > 0) return v.unexpected.join("; ");
  if (v.notes) return v.notes;
  return v.status === "held" ? "no cheaper path found" : "";
}

/** A one-line-per-attack markdown table plus a header the reader can trust. */
export function reportMarkdown(verdicts: Verdict[], now = new Date()): string {
  const counts = verdicts.reduce<Record<string, number>>((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {});
  const order: Verdict["status"][] = ["held", "cheap", "broken", "pending"];
  const tally = order
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${LABEL[s]}`)
    .join(" · ");

  const lines: string[] = [];
  lines.push("# Sentinel report");
  lines.push("");
  lines.push(`Run ${now.toISOString()} against the Policy Twin engine — simulation only.`);
  lines.push("");
  lines.push(`**${verdicts.length} attacks: ${tally || "none"}**`);
  lines.push("");
  lines.push("HELD — the rule stopped it. CHEAP — allowed, but the incentive is worth noting.");
  lines.push("BROKEN — an invariant or a stated expectation failed.");
  lines.push("");
  lines.push("| Attack | WP | Verdict | What happened |");
  lines.push("|---|---|---|---|");
  for (const v of verdicts) {
    const detail = summarize(v).replace(/\|/g, "\\|");
    lines.push(`| \`${v.id}\` | ${v.wp} | **${LABEL[v.status]}** | ${detail} |`);
  }
  lines.push("");
  lines.push("Attacks run against the local engine, not mainnet.");
  return lines.join("\n");
}

/** Compact console table for the CLI. */
export function reportConsole(verdicts: Verdict[]): string {
  const idW = Math.max(6, ...verdicts.map((v) => v.id.length));
  return verdicts
    .map((v) => {
      const detail = summarize(v);
      return `${v.id.padEnd(idW)}  ${LABEL[v.status].padEnd(7)}  ${detail}`;
    })
    .join("\n");
}

/**
 * CI fails on broken rules, never on yellow findings.
 *
 * "Cheap" is an opinion about incentives and must never block a merge. A
 * broken *invariant* is an engine bug whichever fixture tripped it, so an
 * incentive fixture that breaks one still fails the run.
 */
export function shouldFail(verdicts: Verdict[]): boolean {
  return verdicts.some(
    (v) => v.broken.length > 0 || (v.severity === "invariant" && v.status === "broken"),
  );
}
