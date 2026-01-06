import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
// @ts-ignore - optional dependency; install with `npm ci` to enable full timezone handling
import { DateTime } from 'luxon';

export const runtime = "nodejs";

async function fetchNewsApiArticles(ticker: string, from: string, to: string, apiKey: string, opts?: { domains?: string[]; sources?: string[]; excludeDomains?: string[] }) {
  // Build a tighter query focused on headlines and business-relevant keywords to reduce noise
  const q = `${ticker} AND (earnings OR revenue OR guidance OR acquisition OR merger OR SEC OR analyst OR stock OR price)`;
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('from', from);
  params.set('to', to);
  // Restrict search to titles and prefer relevancy; fetch up to 100 results to allow good post-filtering
  params.set('searchIn', 'title');
  params.set('sortBy', 'relevancy');
  params.set('pageSize', '100');
  params.set('language', 'en');
  if (opts?.domains && opts.domains.length) params.set('domains', opts.domains.join(','));
  if (opts?.sources && opts.sources.length) params.set('sources', opts.sources.join(','));
  if (opts?.excludeDomains && opts.excludeDomains.length) params.set('excludeDomains', opts.excludeDomains.join(','));
  params.set('apiKey', apiKey);
  const url = `https://newsapi.org/v2/everything?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  return res.json();
} 

async function fetchStooqNews(ticker: string, from: string, to: string) {
  // Stooq does not require an API key; we scrape the ticker news search page and return simple entries.
  const url = `https://stooq.com/n/?s=${encodeURIComponent(ticker)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Stooq ${res.status}: ${await res.text()}`);
  const text = await res.text();
  // Extract link entries like: <a href="/n/?f=12345">Headline</a>
  const re = /<a[^>]+href="(\/n\/\?f=[^\"]+)"[^>]*>([^<]+)<\/a>/gi;
  const matches: Array<{ href: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ href: m[1], title: m[2].trim() });
  }
  return matches;
}

function pickTopArticlesFromNewsApi(resp: any, n = 3) {
  const articles = Array.isArray(resp?.articles) ? resp.articles : [];
  return articles.slice(0, n).map((a: any) => ({
    headline: a.title || a.description || a.source?.name || "No title",
    summary: a.description || "",
    url: a.url || null,
    datetime: a.publishedAt || null,
    source: a.source?.name || null,
  }));
}

function pickTopArticlesFromStooq(entries: any[], n = 3) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, n).map((e: any) => ({
    headline: e.title || "No title",
    summary: "",
    url: e.href ? `https://stooq.com${e.href}` : null,
    datetime: null,
    source: null,
  }));
}

export async function GET(req: Request) {
  try {
    const cfgPath = path.join(process.cwd(), "data", "portfolio.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const NEWS_API_KEY = process.env.NEWS_API_KEY; // if not provided we fall back to Stooq (no key required)

    const tickers: string[] = Array.isArray(cfg.tickers) ? cfg.tickers : [];
    const to = new Date();
    const toStr = to.toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 2);
    const fromStr = fromDate.toISOString().slice(0, 10);

    // caching
    const CACHE_PATH = path.join(process.cwd(), 'data', 'news-cache.json');
    function readCache() {
      try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (e) { return null; }
    }
    function writeCache(obj: any) { fs.writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8'); }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    const now = DateTime.now().setZone(cfg.timezone || 'UTC');

    const cache = readCache();
    if (cache && cache.expiresAt && !forceRefresh) {
      const expires = DateTime.fromISO(cache.expiresAt).setZone(cfg.timezone || 'UTC');
      if (expires > now && cache.summary) {
        return NextResponse.json({ asOf: cache.asOf, summary: cache.summary, cached: true });
      }
    }

    const summaryByTicker: Record<string, any[]> = {};
    for (const t of tickers) {
      try {
        if (NEWS_API_KEY) {
          const resp = await fetchNewsApiArticles(t, fromStr, toStr, NEWS_API_KEY, {
            domains: Array.isArray(cfg.newsDomains) ? cfg.newsDomains : [],
            sources: Array.isArray(cfg.newsSources) ? cfg.newsSources : [],
            excludeDomains: Array.isArray(cfg.excludeDomains) ? cfg.excludeDomains : [],
          });
          summaryByTicker[t] = pickTopArticlesFromNewsApi(resp, 3);
        } else {
          const entries = await fetchStooqNews(t, fromStr, toStr);
          summaryByTicker[t] = pickTopArticlesFromStooq(entries, 3);
        }
      } catch (e: any) {
        summaryByTicker[t] = [];
      }
    }

    // set cache expiry to next 08:00 in configured timezone
    function next8amAfter(dt: DateTime) {
      let candidate = dt.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
      if (candidate <= dt) candidate = candidate.plus({ days: 1 });
      return candidate;
    }

    const next8 = next8amAfter(now);
    const cacheObj = { asOf: new Date().toISOString(), fetchedAt: now.toISO(), expiresAt: next8.toISO(), summary: summaryByTicker };
    writeCache(cacheObj);

    return NextResponse.json({ asOf: cacheObj.asOf, summary: summaryByTicker, cached: false });
  } catch (err: any) {
    // if fetch failed, try returning last cache if present
    try {
      const CACHE_PATH = path.join(process.cwd(), 'data', 'news-cache.json');
      const raw = fs.readFileSync(CACHE_PATH, 'utf8');
      const cache = JSON.parse(raw);
      return NextResponse.json({ asOf: cache.asOf, summary: cache.summary, warning: 'Returning stale cache due to error', error: err?.message ?? null });
    } catch (e) {
      return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
    }
  }
}
