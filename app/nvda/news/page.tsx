import Link from "next/link";
import RefreshButton from "./RefreshButton";
import fs from "fs";
import path from "path";

export default async function NvdaNewsPage() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  // Try to read cache directly, fallback to API fetch
  const CACHE_PATH = path.join(process.cwd(), "data", "news-cache.json");
  let data = null;
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    data = JSON.parse(raw);
  } catch (e) {
    // fallback to fetch API preview
    try {
      const res = await fetch(`${base}/api/news/summary`);
      if (res.ok) data = await res.json();
    } catch (err) {
      data = null;
    }
  }

  const asOf = data?.asOf ?? null;
  const summary = data?.summary ?? {};
  const cached = !!data?.expiresAt;

  return (
    <main className="min-h-screen p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">NVDA • News</h1>
          <p className="text-sm text-gray-600">Cached summary {asOf ? `as of ${asOf}` : "(no data)"}</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton />
          <Link href="/nvda" className="underline">← Back to Dashboard</Link>
        </div>
      </div>

      {!Object.keys(summary).length && (
        <div className="rounded-md border p-4 bg-white">No cached news available. Click Refresh to fetch.</div>
      )}

      {Object.entries(summary).map(([ticker, articles]: any) => (
        <section key={ticker} className="rounded-md border bg-white p-4 space-y-3">
          <h2 className="text-xl font-bold">{ticker}</h2>
          {!articles.length && <div className="text-sm text-gray-600">No recent articles.</div>}
          <ul className="space-y-2">
            {articles.map((a: any, idx: number) => (
              <li key={idx} className="">
                <a href={a.url ?? '#'} className="font-semibold text-blue-600">{a.headline}</a>
                {a.source ? <div className="text-xs text-gray-500">{a.source} • {a.datetime ? new Date(a.datetime).toLocaleString() : ''}</div> : null}
                {a.summary ? <p className="mt-1 text-sm text-gray-700">{a.summary}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
