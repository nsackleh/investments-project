// src/components/Histogram.tsx
"use client";

import { useMemo, useState } from "react";
import { fmtUsd, fmtPct } from "@/lib/stats";

type Tip = {
  i: number;
  x: number; // px inside container
  y: number; // px inside container
};

export default function Histogram({
  hist,
  bins,
  title = "Terminal Price Histogram",
}: {
  hist: number[];
  bins: number[]; // edges length = hist.length + 1
  title?: string;
}) {
  const [tip, setTip] = useState<Tip | null>(null);

  const ok = hist?.length && bins?.length && bins.length === hist.length + 1;
  const total = useMemo(() => hist.reduce((s, n) => s + n, 0), [hist]);
  const maxCount = useMemo(() => Math.max(...hist, 1), [hist]);

  if (!ok) return null;

  const active = tip?.i ?? -1;

  const activeData = useMemo(() => {
    if (active < 0) return null;
    const left = bins[active];
    const right = bins[active + 1];
    const count = hist[active];
    const prob = total > 0 ? count / total : NaN;
    const mid = (left + right) / 2;
    return { left, right, mid, count, prob };
  }, [active, bins, hist, total]);

  return (
    <div className="border rounded-xl p-4 relative">
      <p className="text-sm opacity-70 mb-3">{title}</p>

      <div
        className="relative"
        onMouseLeave={() => setTip(null)}
      >
        <div className="flex items-end gap-1 h-44">
          {hist.map((count, i) => {
            const heightPct = (count / maxCount) * 100;

            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-opacity ${
                  active === i ? "opacity-100" : active === -1 ? "opacity-100" : "opacity-50"
                } bg-zinc-800/80`}
                style={{ height: `${heightPct}%` }}
                onMouseMove={(e) => {
                  const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                  setTip({
                    i,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
              />
            );
          })}
        </div>

        {/* Tooltip */}
        {tip && activeData && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: Math.min(tip.x + 12, 520),
              top: Math.max(tip.y - 70, 0),
            }}
          >
            <div className="rounded-lg border bg-white px-3 py-2 shadow-sm text-sm">
              <div className="font-semibold">
                {fmtUsd(activeData.left)} – {fmtUsd(activeData.right)}
              </div>
              <div className="opacity-70">
                Mid: {fmtUsd(activeData.mid)}
              </div>
              <div className="mt-1">
                <span className="font-medium">{activeData.count.toLocaleString()}</span>{" "}
                sims ({fmtPct(activeData.prob)})
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-between text-xs opacity-70">
        <span>{bins[0].toFixed(0)}</span>
        <span>{bins[bins.length - 1].toFixed(0)}</span>
      </div>

      <p className="mt-2 text-xs opacity-60">
        Hover a bar to see the terminal price range, count, and probability.
      </p>
    </div>
  );
}
