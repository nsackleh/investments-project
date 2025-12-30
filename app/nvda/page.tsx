type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function pct(a: number, b: number) {
  if (!Number.isFinite(a) || a === 0) return NaN;
  return (b - a) / a;
}

function stddev(values: number[]) {
  if (values.length < 2) return NaN;
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const var_ =
    values.reduce((s, x) => s + (x - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(var_);
}

import Link from "next/link";

function Sparkline({ closes }: { closes: number[] }) {
  const w = 900;
  const h = 240;
  const pad = 10;

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const points = closes
    .map((c, i) => {
      const x = pad + (i * (w - 2 * pad)) / (closes.length - 1);
      const y =
        pad + (h - 2 * pad) * (1 - (c - min) / range);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-xl border">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

export default async function NvdaPage() {
  // SIMPLE + RELIABLE (local dev)
  const res = await fetch("http://localhost:3000/api/prices/nvda", {
    cache: "no-store",
  });

  const data = await res.json();
  const bars: Bar[] = data.bars ?? [];

  if (bars.length < 40) {
    return (
      <main className="min-h-screen p-10">
        <h1 className="text-4xl font-semibold">NVDA</h1>
        <p className="mt-2 text-zinc-600">Not enough data returned.</p>
        <a href="/" className="underline mt-6 inline-block">← Back home</a>
      </main>
    );
  }


  
  const closes = bars.map(b => b.close);
  const latest = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const r1d = pct(prev.close, latest.close);
  const r1w = pct(bars[bars.length - 6]?.close, latest.close);
  const r1m = pct(bars[bars.length - 22]?.close, latest.close);
  const r1y = pct(bars[bars.length - 252]?.close, latest.close);

  const rets30 = closes
    .slice(-31)
    .map((c, i, arr) =>
      i === 0 ? 0 : Math.log(c / arr[i - 1])
    )
    .slice(1);

  const vol30 = stddev(rets30) * Math.sqrt(252);

  const fmtPct = (x: number) =>
    Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : "—";

  return (
    <main className="min-h-screen p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-semibold">NVDA</h1>
          <p className="text-sm opacity-70">
            Last updated: {latest.date}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-70">Latest Close</p>
          <p className="text-4xl font-semibold">${latest.close.toFixed(2)}</p>
          <p className="text-sm opacity-70">1D: {fmtPct(r1d)}</p>
        </div>
      </div>

      <div className="mt-4 border-b border-gray-200">
        <nav className="flex gap-4" aria-label="tabs">
          <Link href="/nvda" className="pb-3 border-b-2 border-blue-600 text-blue-600 font-medium">Overview</Link>
          <Link href="/nvda/dcf" className="pb-3 text-gray-600 hover:text-blue-600">DCF</Link>
        </nav>
      </div>

      <Sparkline closes={closes} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="1W Return" value={fmtPct(r1w)} />
        <Metric label="1M Return" value={fmtPct(r1m)} />
        <Metric label="1Y Return" value={fmtPct(r1y)} />
        <Metric label="30D Vol (ann.)" value={fmtPct(vol30)} />
      </div>

      <a href="/" className="underline">← Back home</a>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}


