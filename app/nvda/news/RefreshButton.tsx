"use client";

export default function RefreshButton() {
  async function onRefresh() {
    try {
      const resp = await fetch('/api/news/summary?refresh=1');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // simple page reload to show updated cache
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert('Refresh failed: ' + msg);
    }
  }

  return (
    <button
      onClick={onRefresh}
      className="rounded-md border px-3 py-1 text-sm hover:bg-gray-100"
    >
      Refresh
    </button>
  );
}
