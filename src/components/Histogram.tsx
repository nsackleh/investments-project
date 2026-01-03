// src/components/Histogram.tsx
"use client";

export default function Histogram({
  hist,
  bins,
  title = "Terminal Price Histogram",
}: {
  hist: number[];
  bins: number[]; // edges length = hist.length + 1
  title?: string;
}) {
  if (!hist?.length || !bins?.length || bins.length !== hist.length + 1) {
    return null;
  }

  const maxCount = Math.max(...hist, 1);

  return (
    <div className="border rounded-xl p-4">
      <p className="text-sm opacity-70 mb-3">{title}</p>

      <div className="flex items-end gap-1 h-44">
        {hist.map((count, i) => {
          const heightPct = (count / maxCount) * 100;
          const left = bins[i];
          const right = bins[i + 1];

          return (
            <div
              key={i}
              className="flex-1 rounded-sm bg-zinc-800/80"
              style={{ height: `${heightPct}%` }}
              title={`${left.toFixed(2)} – ${right.toFixed(2)} : ${count}`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-xs opacity-70">
        <span>{bins[0].toFixed(0)}</span>
        <span>{bins[bins.length - 1].toFixed(0)}</span>
      </div>

      <p className="mt-2 text-xs opacity-60">
        Each bar shows how many Monte Carlo simulations ended in that terminal price range.
      </p>
    </div>
  );
}
