// src/lib/prices.ts

import type { Bar, PricesResponse } from "./types";
import { getApiBaseUrl } from "./baseUrl";

export async function getBars(symbol: string, revalidateSeconds = 60 * 60 * 24): Promise<Bar[]> {
  const base = getApiBaseUrl();
  const url = `${base}/api/prices/${symbol.toLowerCase()}`;

  const res = await fetch(url, { next: { revalidate: revalidateSeconds } });
  if (!res.ok) throw new Error(`Failed to fetch prices for ${symbol}: ${res.status}`);

  const data = (await res.json()) as PricesResponse;
  return data.bars ?? [];
}
