const WAD = 10n ** 18n;

/** Format a 1e18-scaled bigint as a fixed-decimal string without float precision loss. */
export function fmtWad(v: bigint, decimals = 2): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / WAD;
  const frac = abs % WAD;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  const body = decimals > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function fmtToken(v: bigint): string {
  return fmtWad(v, 2);
}

export function fmtEth(v: bigint): string {
  return fmtWad(v, 4);
}

export function fmtPct(x: number, decimals = 1): string {
  return `${(x * 100).toFixed(decimals)}%`;
}

export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (d === 0 && m > 0) parts.push(`${m}m`);
  return parts.length > 0 ? parts.join(" ") : "<1m";
}
