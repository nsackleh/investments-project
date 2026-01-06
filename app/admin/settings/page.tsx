"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState("");
  // Chip-style tickers input
  const [tickersList, setTickersList] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/settings');
        const json = await res.json();
        const config = json.config ?? { tickers: [], recipientEmail: '', deliveryTime: '09:00', timezone: 'UTC' };
        setCfg(config);
        setTickersList(Array.isArray(config.tickers) ? config.tickers : []);
      } catch (e) {
        setCfg({ tickers: [], recipientEmail: '', deliveryTime: '09:00', timezone: 'UTC' });
        setTickersList([]);
        setStatus('Failed to load current settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  const submit = async (e: any) => {
    e.preventDefault();
    setStatus(null);
    try {
      const tickers = (tickersList || []).map((t) => t.trim().toUpperCase()).filter(Boolean);
      const body = {
        tickers,
        recipientEmail: cfg.recipientEmail,
        deliveryTime: cfg.deliveryTime,
        timezone: cfg.timezone,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus(json?.error || 'Failed to update settings');
        return;
      }
      setStatus('Saved successfully');
      setCfg(json.config);
      setTickersList(Array.isArray(json.config?.tickers) ? json.config.tickers : []);
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    }
  };

  function addTickerFromInput() {
    const t = (newTicker || '').toUpperCase().trim();
    if (!t) return setNewTicker('');
    setTickersList((s) => (s.includes(t) ? s : [...s, t]));
    setNewTicker('');
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin Settings</h1>

      <form onSubmit={submit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tickers (comma-separated)</label>
          <div className="flex gap-2">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTickerFromInput(); } }}
            placeholder="Type ticker and press Enter or click Add"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          <button type="button" onClick={() => addTickerFromInput()} className="mt-1 px-3 py-2 bg-gray-200 rounded">Add</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tickersList.map((t) => (
            <div key={t} className="inline-flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-sm">
              <span className="font-medium">{t}</span>
              <button type="button" onClick={() => setTickersList(s => s.filter(x => x !== t))} className="text-xs text-gray-500">×</button>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">{tickersList.length} tickers will be saved</div>
        </div>

        <div className="pt-2">
          <a href="/admin/news" className="text-sm text-blue-600 underline">View cached news & refresh</a>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Recipient Email</label>
          <input
            type="email"
            value={cfg.recipientEmail || ''}
            onChange={(e) => setCfg((c: any) => ({ ...c, recipientEmail: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Delivery Time (HH:MM)</label>
            <input
              type="time"
              value={cfg.deliveryTime || '09:00'}
              onChange={(e) => setCfg((c: any) => ({ ...c, deliveryTime: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Timezone</label>
            <input
              type="text"
              value={cfg.timezone || 'UTC'}
              onChange={(e) => setCfg((c: any) => ({ ...c, timezone: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Admin Key (paste to authorize)</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            placeholder="ADMIN_API_KEY"
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-md bg-blue-600 text-white px-4 py-2">Save</button>
          <span className="text-sm text-gray-600">{status}</span>
        </div>
      </form>
    </main>
  );
}
