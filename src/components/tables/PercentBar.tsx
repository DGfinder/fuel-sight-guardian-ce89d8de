type Props = { percent: number };
export default function PercentBar({ percent }: Props) {
  const pct = Math.min(Math.max(percent, 0), 100);
  const color =
    pct < 20 ? 'bg-red-500'
  : pct < 40 ? 'bg-amber-400'
  : 'bg-emerald-600';

  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200/70">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
} 