import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const adminKey = req.headers.get('x-admin-key');
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
    if (!ADMIN_API_KEY) return NextResponse.json({ error: 'ADMIN_API_KEY not configured on server' }, { status: 500 });
    if (!adminKey || adminKey !== ADMIN_API_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    if (!NEWS_API_KEY) return NextResponse.json({ error: 'NEWS_API_KEY not configured on server' }, { status: 400 });

    const url = `https://newsapi.org/v2/top-headlines/sources?category=business&language=en`;
    const res = await fetch(url, { headers: { 'X-Api-Key': NEWS_API_KEY } });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `NewsAPI ${res.status}: ${text}` }, { status: 502 });
    }

    const json = await res.json();
    const sources = Array.isArray(json?.sources) ? json.sources : [];

    const uniqSources = [] as Array<{ id: string | null; name: string | null; url: string | null }>;
    const domains = new Set<string>();

    for (const s of sources) {
      uniqSources.push({ id: s.id ?? null, name: s.name ?? null, url: s.url ?? null });
      try {
        if (s.url) {
          const u = new URL(s.url);
          let host = u.hostname.toLowerCase();
          if (host.startsWith('www.')) host = host.slice(4);
          domains.add(host);
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    return NextResponse.json({ sources: uniqSources, domains: Array.from(domains).sort() });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}