"use client";

import { useEffect, useState } from "react";

export default function AdminNewsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<any>({ sources: [], domains: [] });
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/news/summary');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        setStatus('Failed to load cached news');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function onRefresh(e: any) {
    e.preventDefault();
    setStatus(null);
    if (!adminKey) {
      setStatus('Enter ADMIN_API_KEY to refresh');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/news/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error || 'Refresh failed');
        return;
      }
      setData(json?.result ?? json);
      setStatus('Refreshed successfully');
    } catch (e: any) {
      setStatus(e?.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }

  // Fetch suggested sources/domains from NewsAPI (requires NEWS_API_KEY server-side)
  async function onFetchSuggested(e: any) {
    e?.preventDefault();
    setStatus(null);
    if (!adminKey) {
      setStatus('Enter ADMIN_API_KEY to fetch suggestions');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/news/sources', { headers: { 'x-admin-key': adminKey } });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error || 'Failed to fetch suggestions');
        return;
      }
      setSuggested({ sources: json.sources || [], domains: json.domains || [] });
      setStatus('Fetched suggestions — select items to apply');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  }

  async function applySuggested(type: 'domains' | 'sources') {
    setStatus(null);
    if (!adminKey) return setStatus('Enter ADMIN_API_KEY to apply');
    try {
      setLoading(true);
      // Get current settings so we include required fields
      const cfgRes = await fetch('/api/admin/settings');
      const cfgJson = await cfgRes.json();
      const cfg = cfgJson.config || { tickers: [], recipientEmail: '', deliveryTime: '09:00', timezone: 'UTC' };

      const body: any = {
        tickers: cfg.tickers,
        recipientEmail: cfg.recipientEmail,
        deliveryTime: cfg.deliveryTime,
        timezone: cfg.timezone,
      };

      if (type === 'domains') body.newsDomains = selectedDomains.length ? selectedDomains : suggested.domains;
      if (type === 'sources') body.newsSources = selectedSources.length ? selectedSources : suggested.sources.map((s: any) => s.id).filter(Boolean);

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error || 'Failed to save whitelist');
        return;
      }
      setStatus('Whitelist applied successfully');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to apply whitelist');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin • Cached News</h1>
          <p className="text-sm text-gray-600">View and refresh the cached news summary for all tracked tickers.</p>
        </div>
      </div>

      <form onSubmit={onRefresh} className="mb-4 flex gap-2 items-center">
        <input type="password" placeholder="ADMIN_API_KEY" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} className="px-3 py-2 border rounded" />
        <button className="px-3 py-2 bg-blue-600 text-white rounded">Refresh Cache</button>
        <span className="text-sm text-gray-600">{status}</span>
      </form>

      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Fetch suggested whitelist from NewsAPI</h3>
        <div className="flex gap-2 items-center mb-2">
          <button onClick={onFetchSuggested} className="px-3 py-2 bg-green-600 text-white rounded">Fetch Suggestions</button>
          <span className="text-sm text-gray-600">(requires server NEWS_API_KEY and ADMIN_API_KEY)</span>
        </div>

        {suggested && (suggested.domains?.length || suggested.sources?.length) ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border p-3 bg-white">
              <h4 className="font-semibold">Domains ({suggested.domains.length})</h4>
              <div className="max-h-48 overflow-auto mt-2 space-y-1">
                {suggested.domains.map((d: string) => (
                  <label key={d} className="block text-sm">
                    <input type="checkbox" checked={selectedDomains.includes(d)} onChange={(e) => {
                      setSelectedDomains(s => e.target.checked ? [...s, d] : s.filter(x => x !== d));
                    }} />
                    <span className="ml-2">{d}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => applySuggested('domains')} className="px-3 py-1 bg-blue-600 text-white rounded">Apply Domains</button>
                <button onClick={() => setSelectedDomains(suggested.domains)} className="px-3 py-1 bg-gray-200 rounded">Select All</button>
              </div>
            </div>

            <div className="rounded-md border p-3 bg-white">
              <h4 className="font-semibold">Sources ({suggested.sources.length})</h4>
              <div className="max-h-48 overflow-auto mt-2 space-y-1">
                {suggested.sources.map((s: any) => (
                  <label key={s.id ?? s.name} className="block text-sm">
                    <input type="checkbox" checked={selectedSources.includes(s.id)} onChange={(e) => {
                      setSelectedSources(sarr => e.target.checked ? [...sarr, s.id] : sarr.filter(x => x !== s.id));
                    }} />
                    <span className="ml-2">{s.name} {s.url ? <span className="text-xs text-gray-500">({s.url.replace(/^https?:\/\//, '')})</span> : null}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => applySuggested('sources')} className="px-3 py-1 bg-blue-600 text-white rounded">Apply Sources</button>
                <button onClick={() => setSelectedSources(suggested.sources.map((x: any) => x.id).filter(Boolean))} className="px-3 py-1 bg-gray-200 rounded">Select All</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {loading && <div>Loading...</div>}

      {!loading && (!data || !data.summary) && (
        <div className="rounded-md border p-4 bg-white">No cached news available.</div>
      )}

      {!loading && data && data.summary && Object.entries(data.summary).map(([ticker, articles]: any) => (
        <section key={ticker} className="rounded-md border bg-white p-4 space-y-3 mb-4">
          <h2 className="text-xl font-bold">{ticker}</h2>
          {!articles.length && <div className="text-sm text-gray-600">No recent articles.</div>}
          <ul className="space-y-2">
            {articles.map((a: any, idx: number) => (
              <li key={idx}>
                <a href={a.url ?? '#'} className="font-semibold text-blue-600" target="_blank" rel="noreferrer">{a.headline}</a>
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
