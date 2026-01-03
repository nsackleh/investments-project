// src/lib/financials.ts

import type { FinancialsResponse } from "./types";
import { getApiBaseUrl } from "./baseUrl";

export async function getFinancials(symbol: string, revalidateSeconds = 60 * 60): Promise<FinancialsResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/financials/${symbol.toLowerCase()}`;

  const res = await fetch(url, { next: { revalidate: revalidateSeconds } });
  if (!res.ok) throw new Error(`Failed to fetch financials for ${symbol}: ${res.status}`);

  return (await res.json()) as FinancialsResponse;
}
