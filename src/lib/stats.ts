// src/lib/stats.ts

export function pct(a: number, b: number) {
  if (!Number.isFinite(a) || a === 0) return NaN;
  return (b - a) / a;
}

export function mean(xs: number[]) {
  if (xs.length === 0) return NaN;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function stddev(values: number[]) {
  if (values.length < 2) return NaN;
  const m = mean(values);
  const v =
    values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function logReturns(closes: number[]) {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) out.push(Math.log(b / a));
  }
  return out;
}

export function annualizeVol(dailyLogRets: number[], tradingDays = 252) {
  const sd = stddev(dailyLogRets);
  return Number.isFinite(sd) ? sd * Math.sqrt(tradingDays) : NaN;
}

export function quantile(sorted: number[], q: number) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const qq = Math.min(1, Math.max(0, q));
  const pos = (n - 1) * qq;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const w = pos - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function histogram(values: number[], bins = 50) {
  if (values.length === 0) return { hist: [], edges: [] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) edges.push(min + (i * range) / bins);

  const hist = new Array(bins).fill(0);
  for (const v of values) {
    const t = (v - min) / range;
    let idx = Math.floor(t * bins);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    hist[idx] += 1;
  }

  return { hist, edges };
}

export const fmtPct = (x: number) =>
  Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : "—";

export const fmtUsd = (x: number) =>
  Number.isFinite(x) ? `$${x.toFixed(2)}` : "—";
