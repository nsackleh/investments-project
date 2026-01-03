// src/components/Sparkline.tsx

export default function Sparkline({ closes }: { closes: number[] }) {
  const w = 900;
  const h = 240;
  const pad = 10;

  if (!closes?.length) {
    return <div className="w-full h-40 rounded-xl border" />;
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const points = closes
    .map((c, i) => {
      const x = pad + (i * (w - 2 * pad)) / (closes.length - 1);
      const y = pad + (h - 2 * pad) * (1 - (c - min) / range);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-xl border">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}
