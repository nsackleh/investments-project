// src/lib/metrics.ts

import type { Bar } from "./types";
import { pct, logReturns, annualizeVol } from "./stats";

export function computeBasicMetrics(bars: Bar[]) {
  const closes = bars.map((b) => b.close);
  const latest = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const r1d = pct(prev.close, latest.close);
  const r1w = pct(bars[bars.length - 6]?.close, latest.close);
  const r1m = pct(bars[bars.length - 22]?.close, latest.close);
  const r1y = pct(bars[bars.length - 252]?.close, latest.close);

  // 30D annualized vol from last 31 closes -> 30 returns
  const rets30 = logReturns(closes.slice(-31));
  const vol30 = annualizeVol(rets30);

  return { closes, latest, prev, r1d, r1w, r1m, r1y, vol30 };
}
