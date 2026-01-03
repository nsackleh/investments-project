// src/components/Histogram.tsx
"use client";

import { useMemo, useState } from "react";
import { fmtUsd, fmtPct } from "@/lib/stats";

type Tip = {
  i: number;
  x: number;
  y: number;
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export default function Histogram({
  hist,
  bins,
  title = "Terminal Price Histogram",
  spot,
  p5,
  p50,
  p95,
}: {
  hist: number[];
  bins: number[]; // edges length = hist.length + 1
  title?: string;

  // overlays (optional but recommended)
  spot?: number;
  p5?: number;
  p50?: number;
  p95?: number;
}) {
  const [tip, setTip] = useState<Tip | null>(null);

  const ok = hist?.length && bins?.length && bins.length === hist.length + 1;
  if (!ok) return null;

  const total = useMemo(() => hist.reduce((s, n) => s + n, 0), [hist]);
  const maxCount = useMemo(() => Math.max(...hist, 1), [hist]);

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

  // Actionable: probability mass below spot (terminal < spot)
  const probBelowSpot = useMemo(() => {
    if (!Number.isFinite(spot ?? NaN)) return NaN;
    const s = spot as number;
    let below = 0;

    for (let i = 0; i < hist.length; i++) {
      const left = bins[i];
      const right = bins[i + 1];
      const count = hist[i];

      if (right <= s) {
        below += count;
      } else if (left < s && s < right) {
        // allocate partial bin proportionally (simple linear split)
        const frac = (s - left) / (right - left);
        below += count * frac;
      }
    }
    return total > 0 ? below / total : NaN;
  }, [spot, hist, bins, total]);

  // Percentile of spot in terminal distribution (same as probBelowSpot)
  const spotPercentile = useMemo(() => {
    if (!Number.isFinite(probBelowSpot)) return NaN;
    return probBelowSpot;
  }, [probBelowSpot]);

  // Map a value to an x position (%) along the histogram width
  const xPct = (v?: number) => {
    if (!Number.isFinite(v ?? NaN)) return null;
    const min = bins[0];
    const max = bins[bins.length - 1];
    const vv = v as number;
    const t = (vv - min) / (max - min || 1);
    return clamp(t, 0, 1) * 100;
  };

  const spotX = xPct(spot);
  const p5X = xPct(p5);
  const p50X = xPct(p50);
  const p95X = xPct(p95);

  return (
    <div className="border rounded-xl p-4 relative">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm opacity-70">{title}</p>

        {/* Actionable header stats */}
        <div className="text-right text-sm">
          {Number.isFinite(spot ?? NaN) && (
            <div className="opacity-70">
              Spot: <span className="font-medium text-zinc-900">{fmtUsd(spot as number)}</span>
            </div>
          )}
          {Number.isFinite(spotPercentile) && (
            <div className="opacity-70">
              Spot Percentile:{" "}
              <span className="font-medium text-zinc-900">
                {(spotPercentile * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {Number.isFinite(probBelowSpot) && (
            <div className="opacity-70">
              P(Terminal &lt; Spot):{" "}
              <span className="font-medium text-zinc-900">{fmtPct(probBelowSpot)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-3" onMouseLeave={() => setTip(null)}>
        {/* Overlay lines */}
        <div className="pointer-events-none absolute inset-0">
          {p5X !== null && (
            <div
              className="absolute top-0 bottom-6 w-[2px] bg-zinc-300"
              style={{ left: `${p5X}%` }}
              title="P5"
            />
          )}
          {p50X !== null && (
            <div
              className="absolute top-0 bottom-6 w-[2px] bg-zinc-400"
              style={{ left: `${p50X}%` }}
              title="Median"
            />
          )}
          {p95X !== null && (
            <div
              className="absolute top-0 bottom-6 w-[2px] bg-zinc-300"
              style={{ left: `${p95X}%` }}
              title="P95"
            />
          )}
          {spotX !== null && (
            <div
              className="absolute top-0 bottom-6 w-[3px] bg-blue-600"
              style={{ left: `${spotX}%` }}
              title="Spot"
            />
          )}
        </div>

        {/* Histogram bars */}
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
              left: clamp(tip.x + 12, 8, 520),
              top: clamp(tip.y - 70, 0, 999),
            }}
          >
            <div className="rounded-lg border bg-white px-3 py-2 shadow-sm text-sm">
              <div className="font-semibold">
                {fmtUsd(activeData.left)} – {fmtUsd(activeData.right)}
              </div>
              <div className="opacity-70">Mid: {fmtUsd(activeData.mid)}</div>
              <div className="mt-1">
                <span className="font-medium">{activeData.count.toLocaleString()}</span>{" "}
                sims ({fmtPct(activeData.prob)})
              </div>
            </div>
          </div>
        )}

        {/* X-axis labels */}
        <div className="mt-3 flex justify-between text-xs opacity-70">
          <span>{bins[0].toFixed(0)}</span>
          <span>{bins[bins.length - 1].toFixed(0)}</span>
        </div>

        {/* Legend */}
        <div className="mt-2 text-xs opacity-70 flex gap-4 flex-wrap">
          {spotX !== null && (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-[2px] bg-blue-600" /> Spot
            </span>
          )}
          {p50X !== null && (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-[2px] bg-zinc-400" /> Median
            </span>
          )}
          {p5X !== null && (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-[2px] bg-zinc-300" /> P5 / P95
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
