// app/api/alpha-vantage/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYMBOL = "CTAS";
const BASE = "https://www.alphavantage.co/query";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;

  if (typeof x === "string") {
    let s = x.trim();
    if (!s || s.toLowerCase() === "none" || s.toLowerCase() === "null") return null;

    // remove commas / % formatting
    s = s.replace(/,/g, "").replace(/%/g, "");

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function pickFirstNum(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = toNum(obj?.[k]);
    if (v !== null) return v;
  }
  return null;
}

function mapByFiscalDate<T extends { fiscalDateEnding?: string }>(
  arr: T[] | undefined | null
) {
  const m = new Map<string, T>();
  if (!Array.isArray(arr)) return m;
  for (const row of arr) {
    if (row?.fiscalDateEnding) m.set(row.fiscalDateEnding, row);
  }
  return m;
}

async function avFetch(fn: string, symbol: string, apikey: string) {
  const url =
    `${BASE}?function=${encodeURIComponent(fn)}` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(apikey)}`;

  const res = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 * 7 }, // cache ~weekly
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AlphaVantage HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json?.Note || json?.Information || json?.Error_Message) {
    throw new Error(
      `AlphaVantage error: ${json?.Error_Message ?? json?.Information ?? json?.Note}`
    );
  }

  return json;
}

function computeOpNwcFromBalanceSheet(bs: any) {
  const totalCurrentAssets = toNum(bs?.totalCurrentAssets);
  const totalCurrentLiabilities = toNum(bs?.totalCurrentLiabilities);

  const cash = pickFirstNum(bs, [
    "cashAndCashEquivalentsAtCarryingValue",
    "cashAndCashEquivalents",
    "cashAndShortTermInvestments",
  ]);

  const shortTermInvestments = pickFirstNum(bs, [
    "shortTermInvestments",
    "currentInvestments",
  ]);

  const shortTermDebt = pickFirstNum(bs, ["shortTermDebt", "currentDebt"]);

  if (totalCurrentAssets === null || totalCurrentLiabilities === null) return null;

  const opAssets = totalCurrentAssets - (cash ?? 0) - (shortTermInvestments ?? 0);
  const opLiabs = totalCurrentLiabilities - (shortTermDebt ?? 0);
  return opAssets - opLiabs;
}

/**
 * Pick shares outstanding for a given fiscal period end date.
 * Prefer diluted, then basic. Choose latest record on/before end date.
 * If none exist on/before, choose the earliest record after end date.
 */
function pickSharesForEndDate(sharesRows: any[], end: string): number | null {
  const endT = Date.parse(end);
  if (!Number.isFinite(endT)) return null;

  const rows = sharesRows
    .map((r) => {
      const t = Date.parse(r?.date ?? "");
      const diluted = pickFirstNum(r, ["shares_outstanding_diluted", "dilutedSharesOutstanding", "diluted_shares_outstanding"]);
      const basic = pickFirstNum(r, ["shares_outstanding_basic", "basicSharesOutstanding", "basic_shares_outstanding"]);
      const shares = diluted ?? basic ?? pickFirstNum(r, ["sharesOutstanding", "shares_outstanding", "shares", "value"]);
      return { t, shares };
    })
    .filter((x) => Number.isFinite(x.t) && x.shares != null) as { t: number; shares: number }[];

  if (!rows.length) return null;

  // latest on/before
  const onOrBefore = rows.filter((r) => r.t <= endT).sort((a, b) => b.t - a.t);
  if (onOrBefore.length) return onOrBefore[0].shares;

  // otherwise earliest after
  const after = rows.sort((a, b) => a.t - b.t);
  return after[0].shares;
}

export async function GET() {
  try {
    const apikey = requiredEnv("ALPHAVANTAGE_API_KEY");

    // Alpha Vantage free tier: ~1 req/sec. Do sequential.
    const isJson = await avFetch("INCOME_STATEMENT", SYMBOL, apikey);
    await sleep(1100);

    const bsJson = await avFetch("BALANCE_SHEET", SYMBOL, apikey);
    await sleep(1100);

    const cfJson = await avFetch("CASH_FLOW", SYMBOL, apikey);
    await sleep(1100);

    const shJson = await avFetch("SHARES_OUTSTANDING", SYMBOL, apikey);

    const annualIS = Array.isArray(isJson?.annualReports) ? isJson.annualReports : [];
    const annualBS = Array.isArray(bsJson?.annualReports) ? bsJson.annualReports : [];
    const annualCF = Array.isArray(cfJson?.annualReports) ? cfJson.annualReports : [];

    const isByDate = mapByFiscalDate(annualIS);
    const bsByDate = mapByFiscalDate(annualBS);
    const cfByDate = mapByFiscalDate(annualCF);

    const sharesQuarterly = Array.isArray(shJson?.data) ? shJson.data : [];
    sharesQuarterly.sort(
      (a: any, b: any) =>
        (Date.parse(b?.date ?? "") || 0) - (Date.parse(a?.date ?? "") || 0)
    );

    // last-ditch fallback: latest quarter shares (prefer diluted)
    const latestShares = sharesQuarterly.length
      ? pickFirstNum(sharesQuarterly[0], [
          "shares_outstanding_diluted",
          "shares_outstanding_basic",
          "dilutedSharesOutstanding",
          "basicSharesOutstanding",
          "sharesOutstanding",
          "shares_outstanding",
          "shares",
          "value",
        ])
      : null;

    const dates = [
      ...new Set([
        ...annualIS.map((r: any) => r?.fiscalDateEnding).filter(Boolean),
        ...annualBS.map((r: any) => r?.fiscalDateEnding).filter(Boolean),
        ...annualCF.map((r: any) => r?.fiscalDateEnding).filter(Boolean),
      ]),
    ].sort((a, b) => Date.parse(b) - Date.parse(a));

    const annual = dates.map((end: string) => {
      const isr: any = isByDate.get(end) ?? {};
      const bsr: any = bsByDate.get(end) ?? {};
      const cfr: any = cfByDate.get(end) ?? {};

      const revenue = pickFirstNum(isr, ["totalRevenue", "revenue"]);
      const ebit = pickFirstNum(isr, ["ebit", "operatingIncome"]);
      const pretax = pickFirstNum(isr, ["incomeBeforeTax"]);
      const taxExpense = pickFirstNum(isr, ["incomeTaxExpense"]);

      const da = pickFirstNum(cfr, [
        "depreciationDepletionAndAmortization",
        "depreciationAndAmortization",
      ]);

      const cfo = pickFirstNum(cfr, ["operatingCashflow", "operatingCashFlow"]);

      const capexRaw = pickFirstNum(cfr, ["capitalExpenditures"]);
      const capex = capexRaw === null ? null : Math.abs(capexRaw);
      const fcf = cfo !== null && capex !== null ? cfo - capex : null;

      const cash = pickFirstNum(bsr, [
        "cashAndCashEquivalentsAtCarryingValue",
        "cashAndCashEquivalents",
      ]);

      const shortTermInvestments = pickFirstNum(bsr, [
        "shortTermInvestments",
        "currentInvestments",
      ]);

      const cashPlusInvestments = (cash ?? 0) + (shortTermInvestments ?? 0);

      const debtCurrent = pickFirstNum(bsr, ["shortTermDebt", "currentDebt"]);
      const debtLong = pickFirstNum(bsr, ["longTermDebt", "longTermDebtNoncurrent"]);

      const totalDebt = (debtCurrent ?? 0) + (debtLong ?? 0);
      const netDebt = totalDebt - cashPlusInvestments;

      const opNwc = computeOpNwcFromBalanceSheet(bsr);

      const ebitMargin = revenue && ebit !== null ? ebit / revenue : null;

      const effectiveTaxRate =
        pretax && pretax !== 0 && taxExpense !== null
          ? Math.max(0, Math.min(0.5, taxExpense / pretax))
          : null;

      // ✅ NEW: shares aligned to this fiscal period end date
      const sharesAtEnd =
        pickFirstNum(isr, ["weightedAverageShsOutDil", "weightedAverageShsOut"]) ??
        pickSharesForEndDate(sharesQuarterly, end) ??
        latestShares ??
        null;

      return {
        fy: end ? new Date(end).getFullYear() : null,
        end,
        revenue,
        ebit,
        da,
        cfo,
        capex,
        fcf,
        cash,
        shortTermInvestments,
        cashPlusInvestments,
        totalDebt,
        netDebt,
        sharesOutstanding: sharesAtEnd,
        opNwc,
        ebitMargin,
        effectiveTaxRate,
        deltaOpNwc: null as number | null,
      };
    });

    for (let i = 0; i < annual.length; i++) {
      const curr = annual[i];
      const prev = annual[i + 1];
      curr.deltaOpNwc =
        curr?.opNwc != null && prev?.opNwc != null ? curr.opNwc - prev.opNwc : null;
    }

    const latest = annual[0] ?? null;

    return NextResponse.json({
      provider: "alpha_vantage",
      symbol: SYMBOL,
      asOf: { latestPeriodEnd: latest?.end ?? null },
      latest,
      annual,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
