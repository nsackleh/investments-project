import { NextResponse } from "next/server";

type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function parseStooqCsv(csv: string): Bar[] {
  const lines = csv.trim().split("\n");
  const out: Bar[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const [date, open, high, low, close, volume] = line.split(",");
    const o = Number(open);
    const h = Number(high);
    const l = Number(low);
    const c = Number(close);
    const v = Number(volume);

    if (!date || !Number.isFinite(c)) continue;
    out.push({ date, open: o, high: h, low: l, close: c, volume: v });
  }

  return out;
}

export async function GET() {
  const url = "https://stooq.com/q/d/l/?s=amzn.us&i=d";

  const res = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 }, // cache 24h
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch AMZN prices" }, { status: 502 });
  }

  const csv = await res.text();
  const bars = parseStooqCsv(csv);

  return NextResponse.json({
    symbol: "AMZN",
    source: "stooq",
    bars: bars.slice(-260), // ~1 year
  });
}
