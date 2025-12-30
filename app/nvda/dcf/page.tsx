"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Annual = {
  fy: number | null;
  end: string;
  revenue: number | null;
  ebit: number | null;
  da: number | null;
  cfo: number | null;
  capex: number | null;
  fcf: number | null;
  cash: number | null;
  totalDebt: number | null;
  netDebt: number | null;
  sharesOutstanding: number | null;
  opNwc: number | null;
  deltaOpNwc: number | null;
  ebitMargin: number | null;
  daPct: number | null;
  capexPct: number | null;
  opNwcPct: number | null;
  effectiveTaxRate: number | null;
};

type AlphaVantageResp = {
  provider: string;
  symbol: string;
  asOf: { latestPeriodEnd: string | null };
  latest: Annual;
  annual: Annual[];
};

type Assumptions = {
  years: number;
  revenueCagr: number;
  ebitMargin: number;
  taxRate: number;
  wacc: number;
  terminalGrowth: number;
  exitMultiple: number;
  terminalMethod: "perpetual" | "exit";
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function isNum(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function fmtMoney(x: number) {
  const abs = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(x: number) {
  return `${(x * 100).toFixed(2)}%`;
}

function median(nums: number[]) {
  const a = nums.slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function SliderRow(props: {
  label: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-2 bg-white">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-medium text-gray-900">{props.label}</div>
          {props.hint ? <div className="text-sm text-gray-600">{props.hint}</div> : null}
        </div>
        <div className="font-semibold tabular-nums text-blue-600">{props.format(props.value)}</div>
      </div>

      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.setValue(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{props.format(props.min)}</span>
        <span>{props.format(props.max)}</span>
      </div>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-semibold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

export default function NvdaDcfPage() {
  const [data, setData] = useState<AlphaVantageResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [a, setA] = useState<Assumptions>({
    years: 5,
    revenueCagr: 0.15,
    ebitMargin: 0.50,
    taxRate: 0.15,
    wacc: 0.10,
    terminalGrowth: 0.03,
    exitMultiple: 20,
    terminalMethod: "perpetual",
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/financials/nvda-mock");
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const json: AlphaVantageResp = await res.json();
        
        if (!json.annual || !json.latest) {
          throw new Error("Invalid response format - missing required data");
        }
        
        if ((json as any).error) {
          throw new Error((json as any).error);
        }

        // Set defaults from historical data
        const hist = json.annual.slice(0, 5).filter(x => x.revenue && x.revenue > 0);
        
        // Use recent years (last 3) for margins since they're more representative
        const recentHist = hist.slice(0, 3);
        const ebitMargins = recentHist.map(x => x.ebitMargin).filter(isNum);
        const taxRates = recentHist.map(x => x.effectiveTaxRate).filter(isNum).filter(x => x > 0);
        
        // Calculate historical revenue CAGR (last 3 years for more recent trend)
        if (hist.length >= 3) {
          const oldestRev = hist[2].revenue;
          const latestRev = hist[0].revenue;
          if (oldestRev && latestRev && oldestRev > 0) {
            const years = 2;
            const cagr = Math.pow(latestRev / oldestRev, 1 / years) - 1;
            setA(p => ({ ...p, revenueCagr: clamp(cagr, 0, 0.5) }));
          }
        }

        setA(p => ({
          ...p,
          ebitMargin: median(ebitMargins) ?? p.ebitMargin,
          taxRate: median(taxRates) ?? p.taxRate,
        }));

        setData(json);
        setErr(null);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load financial data";
        setErr(errorMsg);
        console.error("Load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const model = useMemo(() => {
    if (!data) return null;

    const latest = data.latest;
    const baseRevenue = latest.revenue;
    const netDebt = latest.netDebt ?? 0;
    const shares = latest.sharesOutstanding;

    if (!isNum(baseRevenue) || !isNum(shares) || shares <= 0) return null;

    // Historical medians for intensities
    const hist = data.annual.slice(0, 5).filter(x => x.revenue && x.revenue > 0);
    
    const daPct = median(hist.map(x => x.daPct).filter(isNum)) ?? 0.02;
    const capexPct = median(hist.map(x => x.capexPct).filter(isNum)) ?? 0.03;
    const opNwcPct = median(hist.map(x => x.opNwcPct).filter(isNum)) ?? 0.10;

    const years = a.years;
    let revPrev = baseRevenue;

    const rows = [];
    const pvFcff: number[] = [];

    for (let t = 1; t <= years; t++) {
      const revenue = revPrev * (1 + a.revenueCagr);
      const ebit = revenue * a.ebitMargin;
      const nopat = ebit * (1 - a.taxRate);
      
      const da = revenue * daPct;
      const capex = revenue * capexPct;
      const deltaOpNwc = opNwcPct * (revenue - revPrev);
      
      const fcff = nopat + da - capex - deltaOpNwc;
      const disc = 1 / Math.pow(1 + a.wacc, t);
      const pv = fcff * disc;

      pvFcff.push(pv);
      rows.push({ 
        year: t, 
        revenue, 
        ebit, 
        nopat, 
        da, 
        capex, 
        deltaOpNwc, 
        fcff, 
        pv 
      });

      revPrev = revenue;
    }

    // Terminal value
    const last = rows[rows.length - 1];
    const pvTerminalDenom = Math.pow(1 + a.wacc, years);

    let terminalValue = Infinity;

    if (a.terminalMethod === "perpetual") {
      const fcfNext = last.fcff * (1 + a.terminalGrowth);
      const denom = a.wacc - a.terminalGrowth;
      terminalValue = denom > 0 ? fcfNext / denom : Infinity;
    } else {
      const ebitda = last.ebit + last.da;
      terminalValue = ebitda * a.exitMultiple;
    }

    const pvTerminal = terminalValue / pvTerminalDenom;
    const enterpriseValue = pvFcff.reduce((s, x) => s + x, 0) + pvTerminal;
    const equityValue = enterpriseValue - netDebt;
    const valuePerShare = equityValue / shares;

    // Calculate current market price (using latest period data)
    const currentPrice = latest.revenue && shares ? (enterpriseValue / shares) : null;

    return {
      base: {
        revenue: baseRevenue,
        netDebt,
        shares,
        asOf: data.asOf.latestPeriodEnd,
        daPct,
        capexPct,
        opNwcPct,
      },
      rows,
      terminalValue,
      pvTerminal,
      enterpriseValue,
      equityValue,
      valuePerShare,
      currentPrice,
    };
  }, [data, a]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <main className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">NVDA DCF Model</h1>
            <p className="text-gray-600 mt-2">
              Discounted Cash Flow Analysis • Alpha Vantage Data
            </p>
          </div>
        </div>

<div className="mt-4 border-b border-gray-200">
  <nav className="flex gap-4" aria-label="tabs">
    <Link
      href="/nvda"
      className="pb-3 text-gray-600 hover:text-blue-600"
    >
      Overview
    </Link>

    <Link
      href="/nvda/dcf"
      className="pb-3 border-b-2 border-blue-600 text-blue-600 font-medium"
    >
      DCF
    </Link>

    <Link
      href="/nvda/quant"
      className="pb-3 text-gray-600 hover:text-blue-600"
    >
      Quant
    </Link>
  </nav>
</div>
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading financial data...</div>
          </div>
        )}
        
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-medium">{err}</div>
          </div>
        )}

        {model && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Assumptions */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Assumptions</h2>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="font-medium text-gray-900 mb-2">Forecast Period</div>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full bg-white text-gray-900"
                  value={a.years}
                  onChange={(e) => setA((p) => ({ ...p, years: Number(e.target.value) }))}
                >
                  {[5, 7, 10].map((n) => (
                    <option key={n} value={n}>{n} years</option>
                  ))}
                </select>
              </div>

              <SliderRow
                label="Revenue CAGR"
                hint="Historical CAGR set as default"
                value={a.revenueCagr}
                setValue={(v) => setA((p) => ({ ...p, revenueCagr: v }))}
                min={0.00}
                max={0.50}
                step={0.005}
                format={fmtPct}
              />

              <SliderRow
                label="EBIT Margin"
                hint="Median from last 5 years"
                value={a.ebitMargin}
                setValue={(v) => setA((p) => ({ ...p, ebitMargin: v }))}
                min={0.05}
                max={0.70}
                step={0.005}
                format={fmtPct}
              />

              <SliderRow
                label="Tax Rate"
                hint="Effective tax rate from filings"
                value={a.taxRate}
                setValue={(v) => setA((p) => ({ ...p, taxRate: v }))}
                min={0.05}
                max={0.35}
                step={0.005}
                format={fmtPct}
              />

              <SliderRow
                label="WACC (Discount Rate)"
                value={a.wacc}
                setValue={(v) => setA((p) => ({ ...p, wacc: v }))}
                min={0.06}
                max={0.20}
                step={0.005}
                format={fmtPct}
              />

              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="font-medium text-gray-900">Terminal Value Method</div>
                <div className="flex gap-3">
                  <button
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      a.terminalMethod === "perpetual" 
                        ? "bg-blue-600 text-white border-blue-600 font-semibold" 
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                    onClick={() => setA((p) => ({ ...p, terminalMethod: "perpetual" }))}
                  >
                    Perpetual Growth
                  </button>
                  <button
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      a.terminalMethod === "exit" 
                        ? "bg-blue-600 text-white border-blue-600 font-semibold" 
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                    onClick={() => setA((p) => ({ ...p, terminalMethod: "exit" }))}
                  >
                    Exit Multiple
                  </button>
                </div>

                {a.terminalMethod === "perpetual" ? (
                  <SliderRow
                    label="Terminal Growth Rate"
                    value={a.terminalGrowth}
                    setValue={(v) => setA((p) => ({ ...p, terminalGrowth: v }))}
                    min={0.00}
                    max={0.06}
                    step={0.0025}
                    format={fmtPct}
                  />
                ) : (
                  <SliderRow
                    label="Exit Multiple (EV/EBITDA)"
                    value={a.exitMultiple}
                    setValue={(v) => setA((p) => ({ ...p, exitMultiple: v }))}
                    min={5}
                    max={40}
                    step={0.5}
                    format={(v) => `${v.toFixed(1)}x`}
                  />
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm space-y-2">
                <div className="font-medium text-gray-900">Base Data (from Alpha Vantage)</div>
                <div className="text-gray-700">Period ending: {model.base.asOf ?? "—"}</div>
                <div className="text-gray-700">Base revenue: {fmtMoney(model.base.revenue)}</div>
                <div className="text-gray-700">Net debt: {fmtMoney(model.base.netDebt)}</div>
                <div className="text-gray-700">Shares outstanding: {(model.base.shares / 1e9).toFixed(2)}B</div>
                <div className="text-gray-700">D&A % (median): {fmtPct(model.base.daPct)}</div>
                <div className="text-gray-700">CapEx % (median): {fmtPct(model.base.capexPct)}</div>
                <div className="text-gray-700">Op NWC % (median): {fmtPct(model.base.opNwcPct)}</div>
              </div>
            </div>

            {/* Right Column - Results */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Valuation Results</h2>

              <div className="grid grid-cols-2 gap-4">
                <Card label="Enterprise Value" value={fmtMoney(model.enterpriseValue)} />
                <Card label="Equity Value" value={fmtMoney(model.equityValue)} />
                <Card label="Terminal Value (PV)" value={fmtMoney(model.pvTerminal)} />
                <Card 
                  label="Fair Value per Share" 
                  value={`$${model.valuePerShare.toFixed(2)}`}
                  highlight
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
                <div className="font-medium text-gray-900 mb-3">Free Cash Flow Forecast</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="py-2 pr-3 font-medium">Year</th>
                        <th className="py-2 pr-3 font-medium">Revenue</th>
                        <th className="py-2 pr-3 font-medium">EBIT</th>
                        <th className="py-2 pr-3 font-medium">NOPAT</th>
                        <th className="py-2 pr-3 font-medium">FCFF</th>
                        <th className="py-2 pr-3 font-medium">PV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.rows.map((r) => (
                        <tr key={r.year} className="border-b border-gray-100">
                          <td className="py-2 pr-3 font-medium text-gray-900">{r.year}</td>
                          <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtMoney(r.revenue)}</td>
                          <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtMoney(r.ebit)}</td>
                          <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtMoney(r.nopat)}</td>
                          <td className="py-2 pr-3 tabular-nums font-medium text-gray-900">{fmtMoney(r.fcff)}</td>
                          <td className="py-2 pr-3 tabular-nums text-blue-600">{fmtMoney(r.pv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500 mt-3">
                  FCFF = NOPAT + D&A − CapEx − ΔOpNWC
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
                <div className="font-medium text-gray-900 mb-3">Detailed Cash Flow Components</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="py-2 pr-3 font-medium">Year</th>
                        <th className="py-2 pr-3 font-medium">D&A</th>
                        <th className="py-2 pr-3 font-medium">CapEx</th>
                        <th className="py-2 pr-3 font-medium">ΔNWC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.rows.map((r) => (
                        <tr key={r.year} className="border-b border-gray-100">
                          <td className="py-2 pr-3 font-medium text-gray-900">{r.year}</td>
                          <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtMoney(r.da)}</td>
                          <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtMoney(r.capex)}</td>
                          <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtMoney(r.deltaOpNwc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}