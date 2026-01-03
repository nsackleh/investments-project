// src/lib/mc.ts

import { histogram, quantile, mean } from "./stats";

export type MCParams = {
  spot: number;
  muDaily: number;     // e.g. 0.0012 for 0.12%
  sigmaDaily: number;  // e.g. 0.0313 for 3.13%
  days?: number;       // default 252
  sims?: number;       // default 5000
  seed?: number;       // deterministic
  lambda?: number;     // penalty for risk-adj price
};

export type MCResult = {
  spot: number;
  days: number;
  sims: number;

  p5: number;
  p10: number;
  p50: number;
  p90: number;
  p95: number;

  mean: number;
  stdevPrice: number;
  probLoss: number;

  var5Return: number;
  cvar5Return: number;

  riskAdjPrice: number;
  lambda: number;

  hist: number[];
  bins: number[];
};

// ---- deterministic RNG (mulberry32) + normal via Box-Muller ----
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normal01(rng: () => number) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function monteCarloGBM(p: MCParams): MCResult {
  const days = p.days ?? 252;
  const sims = p.sims ?? 5000;
  const seed = p.seed ?? 7;
  const lambda = p.lambda ?? 0.75;

  const spot = p.spot;
  const mu = p.muDaily;
  const sig = p.sigmaDaily;

  const rng = mulberry32(seed);

  const terminals: number[] = new Array(sims);
  const returns: number[] = new Array(sims);

  // GBM: S_T = S_0 * exp( sum((mu - 0.5*sigma^2) + sigma*Z) )
  const drift = mu - 0.5 * sig * sig;

  for (let i = 0; i < sims; i++) {
    let logGrowth = 0;
    for (let t = 0; t < days; t++) {
      const z = normal01(rng);
      logGrowth += drift + sig * z;
    }
    const st = spot * Math.exp(logGrowth);
    terminals[i] = st;
    returns[i] = spot > 0 ? (st - spot) / spot : NaN;
  }

  // sort copies for quantiles / tail risk
  const terminalsSorted = [...terminals].sort((a, b) => a - b);
  const returnsSorted = [...returns].sort((a, b) => a - b);

  const p5 = quantile(terminalsSorted, 0.05);
  const p10 = quantile(terminalsSorted, 0.10);
  const p50 = quantile(terminalsSorted, 0.50);
  const p90 = quantile(terminalsSorted, 0.90);
  const p95 = quantile(terminalsSorted, 0.95);

  const m = mean(terminals);
  const m2 = mean(terminals.map((x) => x * x));
  const stdevPrice = Number.isFinite(m) && Number.isFinite(m2) ? Math.sqrt(Math.max(0, m2 - m * m)) : NaN;

  const probLoss = terminals.filter((x) => x < spot).length / sims;

  // VaR/CVaR 5% on returns
  const var5Return = quantile(returnsSorted, 0.05);
  const cut = Math.floor(0.05 * sims);
  const tail = returnsSorted.slice(0, Math.max(1, cut));
  const cvar5Return = mean(tail);

  // Risk-adjusted price (simple penalty):
  // E[S_T] - λ * StdDev(S_T)
  const riskAdjPrice = Number.isFinite(m) && Number.isFinite(stdevPrice)
    ? m - lambda * stdevPrice
    : NaN;

  const { hist, edges } = histogram(terminals, 50);

  return {
    spot,
    days,
    sims,

    p5,
    p10,
    p50,
    p90,
    p95,

    mean: m,
    stdevPrice,
    probLoss,

    var5Return,
    cvar5Return,

    riskAdjPrice,
    lambda,

    hist,
    bins: edges,
  };
}
