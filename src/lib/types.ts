// src/lib/types.ts

export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PricesResponse = {
  symbol: string;
  source?: string;
  bars: Bar[];
  error?: string;
};

export type FinancialYear = {
  fy: number;
  end: string;
  revenue: number;
  ebit: number;
  da: number;
  cfo: number;
  capex: number;
  fcf: number;
  cash: number;
  shortTermInvestments?: number;
  cashPlusInvestments?: number;
  totalDebt?: number;
  netDebt?: number;
  sharesOutstanding?: number;
  opNwc?: number;
  deltaOpNwc?: number;

  // ratios/derived
  ebitMargin?: number;
  daPct?: number;
  capexPct?: number;
  opNwcPct?: number;
  effectiveTaxRate?: number;

  // allow future fields without breaking types
  [key: string]: unknown;
};

export type FinancialsResponse = {
  provider: string;
  symbol: string;
  asOf?: { latestPeriodEnd?: string; [key: string]: unknown };
  latest: FinancialYear;
  annual: FinancialYear[];
  error?: string;
};
