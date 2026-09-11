/**
 * Order attack ids the way a reader expects: A1, A2, ... A9, A10, A14.
 * A plain string sort puts A10 before A1, which makes the verdict table read
 * like it is missing rows.
 */
export function compareAttackIds(a: string, b: string): number {
  const parse = (id: string): [number, string] => {
    const m = /^A(\d+)(.*)$/.exec(id);
    return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, id];
  };
  const [an, ar] = parse(a);
  const [bn, br] = parse(b);
  return an !== bn ? an - bn : ar.localeCompare(br);
}
