// Fixture loading for the browser. The Sentinel package reads /attacks from
// disk in Node; here the same files are served out of /public and validated
// with the same schema, so the UI cannot run a fixture the CLI would reject.
import { parseFixture } from "@standard-law/sentinel";
import type { AttackFixture } from "@standard-law/sentinel";

export async function fetchAttackIds(): Promise<string[]> {
  const res = await fetch("/attacks/index.json");
  if (!res.ok) throw new Error(`attack manifest unavailable (${res.status})`);
  return (await res.json()) as string[];
}

export async function fetchFixture(id: string): Promise<AttackFixture> {
  const res = await fetch(`/attacks/${id}.json`);
  if (!res.ok) throw new Error(`attack ${id} unavailable (${res.status})`);
  return parseFixture(await res.json());
}

export async function fetchAllFixtures(): Promise<AttackFixture[]> {
  const ids = await fetchAttackIds();
  return Promise.all(ids.map(fetchFixture));
}
