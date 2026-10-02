export interface BarRow {
  label: string;
  sub?: string;
  value: number;
  display: string;
  color?: string;
}

/** Horizontal bars on one shared scale, so rows compare by eye. */
export default function BarRows({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={`${r.label}${r.sub ?? ''}`}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-gray-800">
              {r.label}
              {r.sub ? <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gray-400">{r.sub}</span> : null}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-gray-900">{r.display}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(2, (Math.abs(r.value) / top) * 100)}%`, background: r.color ?? '#111827' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
