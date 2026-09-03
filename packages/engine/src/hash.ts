// Stable, dependency-free hash for scenario replay comparisons.
import type { World } from "./types.js";

function sortedReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `bigint:${value.toString()}`;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = (value as Record<string, unknown>)[k];
    }
    return out;
  }
  return value;
}

function stableStringify(world: World): string {
  // params.meta carries free-form notes only; excluded so param edits that
  // don't change policy don't change the hash.
  const { params, ...rest } = world;
  const { meta: _meta, ...paramsRest } = params;
  return JSON.stringify({ ...rest, params: paramsRest }, sortedReplacer);
}

/** FNV-1a, 32-bit — plenty for scenario-replay equality checks, no crypto dep. */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashWorld(world: World): string {
  return fnv1a(stableStringify(world));
}
