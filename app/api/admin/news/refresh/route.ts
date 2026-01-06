import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const adminKey = req.headers.get("x-admin-key");
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
    if (!ADMIN_API_KEY) return NextResponse.json({ error: "ADMIN_API_KEY not configured" }, { status: 500 });
    if (!adminKey || adminKey !== ADMIN_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const url = `${base}/api/news/summary?refresh=1`;

    const res = await fetch(url, { method: 'GET' });
    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: json?.error ?? 'Failed to refresh' }, { status: res.status });
    }

    return NextResponse.json({ ok: true, result: json });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
