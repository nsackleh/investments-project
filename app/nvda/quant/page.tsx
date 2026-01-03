// app/nvda/quant/page.tsx
import Link from "next/link";

import Histogram from "@/components/Histogram";
import LambdaSlider from "@/components/LambdaSlider";
import Metric from "@/components/Metric";
import { getBars } from "@/lib/prices";
import { logReturns, stddev, fmtPct, fmtUsd } from "@/lib/stats";
import { monteCarloGBM } from "@/lib/mc";

export default async function NvdaQuantPage() {
  const symbol = "nvda";

  // 1) Pull bars from your existing /app/api/prices/* route (via src/lib/prices.ts)
  const bars = await getBars(symbol);

  if (bars.length < 60) {
    return (
      <main className="min-h-screen p-10 max-w-5xl mx-auto space-y-6">
        <h1 className="text-4xl font-semibold">{symbol.toUpperCase()} · Quant</h1>
        <p className="text-zinc-600">Not enough price history returned.</p>
        <Link href={`/${symbol}`} className="underline">← Back</Link>
      </main>
    );
  }

  const closes = bars.map(b => b.close);
  const spot = closes[closes.length - 1];

  // 2) Estimate μ and σ from historical returns
  // Pick a window: last 252 trading days (1Y) is typical
  const window = Math.min(253, closes.length);         // need 253 closes -> 252 returns
  const rets = logReturns(closes.slice(-window));       // daily log returns
  const muDaily = rets.reduce((s, x) => s + x, 0) / rets.length;
  const sigmaDaily = stddev(rets);

  // 3) Run Monte Carlo
  const mc = monteCarloGBM({
    spot,
    muDaily,
    sigmaDaily,
    days: 252,
    sims: 5000,
    seed: 7,
    lambda: 0.75,
  });

  // Helper formatting
  const fmtNum = (x: number) => (Number.isFinite(x) ? x.toFixed(4) : "—");

  return (
    <main className="min-h-screen p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-semibold">{symbol.toUpperCase()} · Quant</h1>
          <p className="text-sm opacity-70">
            Spot: {fmtUsd(spot)} · Sims: {mc.sims.toLocaleString()} · Horizon: {mc.days} trading days
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm opacity-70">Estimated (daily)</p>
          <p className="text-lg">μ: {fmtPct(muDaily)}</p>
          <p className="text-lg">σ: {fmtPct(sigmaDaily)}</p>
          <p className="text-sm opacity-70">Seed: 7 · λ: {mc.lambda}</p>
        </div>
      </div>

      {/* Tabs (match your style) */}
      <div className="mt-4 border-b border-gray-200">
        <nav className="flex gap-4" aria-label="tabs">
          <Link href={`/${symbol}`} className="pb-3 text-gray-600 hover:text-blue-600">Overview</Link>
          <Link href={`/${symbol}/dcf`} className="pb-3 text-gray-600 hover:text-blue-600">DCF</Link>
          <span className="pb-3 border-b-2 border-blue-600 text-blue-600 font-medium">Quant</span>
        </nav>
      </div>

      {/* Distribution summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="P5 (1Y)" value={fmtUsd(mc.p5)} />
        <Metric label="P50 (Median)" value={fmtUsd(mc.p50)} />
        <Metric label="Mean" value={fmtUsd(mc.mean)} />
        <Metric label="P95 (1Y)" value={fmtUsd(mc.p95)} />
      </div>

      {/* Histogram */}
      <Histogram hist={mc.hist} bins={mc.bins} />
      
     {/* Risk */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Prob. Loss (1Y)" value={fmtPct(mc.probLoss)} />
        <Metric label="VaR 5% (Return)" value={fmtPct(mc.var5Return)} />
        <Metric label="CVaR 5% (Return)" value={fmtPct(mc.cvar5Return)} />
        <Metric label="Risk-Adj Price" value={fmtUsd(mc.riskAdjPrice)} />
      </div>

      {/* Slider to adjust lambda */}
      <LambdaSlider mean={mc.mean} stdevPrice={mc.stdevPrice} initialLambda={mc.lambda} />

      {/* Extra diagnostics */}
      <div className="border rounded-xl p-4">
        <p className="text-sm opacity-70">Notes</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>μ/σ are estimated from the last {window - 1} trading days of log returns.</li>
          <li>VaR/CVaR are computed on 1Y return distribution (worst 5%).</li>
          <li>Risk-Adj Price = E[S] − λ·StdDev(S) (simple penalty model).</li>
        </ul>
      </div>

      <Link href={`/${symbol}`} className="underline">← Back</Link>
    </main>
  );
}
