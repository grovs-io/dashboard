export const numberFormatter = new Intl.NumberFormat("de-DE");

/** Relative change in whole percent; 0 when there is no previous value. */
export function pct(cur: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

export function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  // 999,500+ would round to "1000K"; hand it to the M tier so the label never grows a digit.
  if (abs >= 999_500)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return numberFormatter.format(Math.round(n));
}

export function formatAxisNumber(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return numberFormatter.format(Math.round(n));
}
