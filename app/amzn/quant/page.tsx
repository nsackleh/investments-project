import Link from "next/link";

type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function std(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function quantile(sorted: number[], q: number) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const w = pos - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

// deterministic RNG so results don't jump around every build
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller for standard normal draws
function randn(rng: () => number) {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function fmtMoney(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}
function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

export default async function AmznQuantPage() {
  const res = await fetch("http://localhost:3000/api/prices/amzn", {
    next: { revalidate: 3600 },
  });

  const data = await res.json();
  const bars: Bar[] = data.bars ?? [];

  if (bars.length < 260) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="p-10 max-w-5xl mx-auto space-y-6">
          <h1 className="text-4xl font-semibold text-zinc-900">AMZN</h1>
          <p className="text-zinc-600">
            Need ~1 year of data (260+ bars) for stable Monte Carlo estimates.
          </p>
          <a href="/" className="underline text-zinc-700">
            ← Back home
          </a>
        </div>
      </main>
    );
  }

  const closes = bars.map((b) => b.close);
  const S0 = closes[closes.length - 1];

  // daily log returns (last ~252 trading days)
  const logRets = closes
    .slice(-252 - 1)
    .map((c, i, arr) => (i === 0 ? 0 : Math.log(c / arr[i - 1])))
    .slice(1);

  const muD = mean(logRets);
  const sigD = std(logRets);

  // Monte Carlo settings
  const horizonDays = 252; // 1Y
  const nSims = 5000;
  const lambda = 0.75;

  const rng = mulberry32(42);
  const T = horizonDays;
  const drift = (muD - 0.5 * sigD * sigD) * T;
  const diff = sigD * Math.sqrt(T);

  const terminalPrices: number[] = new Array(nSims);
  for (let i = 0; i < nSims; i++) {
    const z = randn(rng);
    terminalPrices[i] = S0 * Math.exp(drift + diff * z);
  }

  const sorted = [...terminalPrices].sort((a, b) => a - b);

  const p05 = quantile(sorted, 0.05);
  const p50 = quantile(sorted, 0.5);
  const p95 = quantile(sorted, 0.95);
  const pMean = mean(terminalPrices);
  const pStd = std(terminalPrices);

  const probLoss = terminalPrices.filter((x) => x < S0).length / nSims;

  const terminalRets = terminalPrices.map((x) => x / S0 - 1);
  const retSorted = [...terminalRets].sort((a, b) => a - b);
  const var05 = quantile(retSorted, 0.05);
  const cvar05 = mean(retSorted.filter((r) => r <= var05));

  const riskAdj = pMean - lambda * pStd;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="p-10 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-zinc-900">AMZN</h1>
            <p className="text-sm text-zinc-500">Quant • Monte Carlo (1Y horizon)</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-500">Spot</p>
            <p className="text-4xl font-semibold text-zinc-900">{fmtMoney(S0)}</p>
            <p className="text-sm text-zinc-500">Sims: {nSims.toLocaleString()}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 border-b border-zinc-200">
          <nav className="flex gap-4" aria-label="tabs">
            <Link href="/amzn" className="pb-3 text-zinc-600 hover:text-zinc-900">
              Overview
            </Link>
            <Link href="/amzn/dcf" className="pb-3 text-zinc-600 hover:text-zinc-900">
              DCF
            </Link>
            <Link href="/amzn/quant" className="pb-3 border-b-2 border-zinc-900 text-zinc-900 font-medium">
              Quant
            </Link>
          </nav>
        </div>

        {/* Core results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="μ (daily, hist.)" value={fmtPct(muD)} />
          <Card label="σ (daily, hist.)" value={fmtPct(sigD)} />
          <Card label="Prob. Loss (1Y)" value={fmtPct(probLoss)} />
          <Card label="Risk-Adj Price" value={fmtMoney(riskAdj)} />
        </div>

        {/* Distribution */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
          <p className="text-sm font-medium text-zinc-900">
            Terminal Price Distribution (1Y)
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Mini label="5th %ile" value={fmtMoney(p05)} />
            <Mini label="Median" value={fmtMoney(p50)} />
            <Mini label="Mean" value={fmtMoney(pMean)} />
            <Mini label="95th %ile" value={fmtMoney(p95)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Mini label="VaR 5% (return)" value={fmtPct(var05)} />
            <Mini label="CVaR 5% (return)" value={fmtPct(cvar05)} />
            <Mini label="StdDev (price)" value={fmtMoney(pStd)} />
            <Mini label="λ (penalty)" value={`${lambda.toFixed(2)}`} />
          </div>
        </div>

        <a href="/" className="underline text-zinc-700">← Back home</a>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 rounded-xl bg-white p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 rounded-xl bg-zinc-50 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
