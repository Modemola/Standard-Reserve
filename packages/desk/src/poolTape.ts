// The last N prints from the shared Store ring buffer. Lab and Desk read the
// same tape, so what the Desk shows is what actually happened to the World.
import type { TapeRow } from "@standard-law/engine";

export const DEFAULT_TAPE_ROWS = 30;

export function poolTape(tape: TapeRow[], lastN: number = DEFAULT_TAPE_ROWS): TapeRow[] {
  return tape.slice(Math.max(0, tape.length - lastN));
}

/** Only the rows that actually moved ETH through the pool. */
export function poolPrints(tape: TapeRow[], lastN: number = DEFAULT_TAPE_ROWS): TapeRow[] {
  return poolTape(
    tape.filter((r) => r.ethIn !== undefined || r.ethOut !== undefined),
    lastN,
  );
}
