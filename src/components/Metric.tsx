// src/components/Metric.tsx

export default function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
