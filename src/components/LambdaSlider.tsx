"use client";

import { useMemo, useState } from "react";
import Metric from "./Metric";
import { fmtUsd } from "@/lib/stats";

export default function LambdaSlider({
  mean,
  stdevPrice,
  initialLambda = 0.75,
}: {
  mean: number;
  stdevPrice: number;
  initialLambda?: number;
}) {
  const [lambda, setLambda] = useState<number>(initialLambda);

  const riskAdj = useMemo(() => {
    if (!Number.isFinite(mean) || !Number.isFinite(stdevPrice)) return NaN;
    return mean - lambda * stdevPrice;
  }, [mean, stdevPrice, lambda]);

  return (
    <div className="border rounded-xl p-4 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm opacity-70">Risk Preference (λ)</p>
          <p className="text-2xl font-semibold">{lambda.toFixed(2)}</p>
        </div>

        <div className="text-right">
          <p className="text-sm opacity-70">Your Risk-Adj Price</p>
          <p className="text-2xl font-semibold">{fmtUsd(riskAdj)}</p>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={1.5}
        step={0.05}
        value={lambda}
        onChange={(e) => setLambda(Number(e.target.value))}
        className="w-full"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="E[S] (Mean)" value={fmtUsd(mean)} />
        <Metric label="StdDev(S)" value={fmtUsd(stdevPrice)} />
        <Metric label="λ" value={lambda.toFixed(2)} />
        <Metric label="Risk-Adj Price" value={fmtUsd(riskAdj)} />
      </div>

      <p className="text-xs opacity-60">
        Risk-Adj Price = E[S] − λ·StdDev(S). Higher λ penalizes risk more.
      </p>
    </div>
  );
}
