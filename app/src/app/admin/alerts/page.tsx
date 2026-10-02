import { getOpenAlerts, type AlertSource, type OpenAlert } from '@/lib/server/admin';

export const metadata = { title: 'Alerts | BlockHelix Admin' };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LABEL: Record<string, { title: string; note: string }> = {
  monitor: { title: 'Risk monitor', note: 'Buffers, carry, pegs, share price and feeds. Checked every 15 minutes.' },
  axis: { title: 'sUSDx backing', note: 'Axis backing, the USDx peg and the sUSDx discount. Checked every 15 minutes.' },
  trades: { title: 'Trade checks', note: 'Trades that came in worse than they predicted. Last 7 days.' },
};

function ago(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Row({ a, now, kind }: { a: OpenAlert; now: number; kind: AlertSource['kind'] }) {
  const critical = a.severity === 'critical';
  return (
    <li className="border-t border-zinc-100 py-3 first:border-t-0">
      <details>
        <summary className="flex cursor-pointer list-none items-baseline gap-3">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${critical ? 'bg-[#b82214]/10 text-[#b82214]' : 'bg-zinc-100 text-zinc-500'}`}
          >
            {critical ? 'critical' : 'warn'}
          </span>
          <span className="min-w-0 flex-1 text-sm text-zinc-900">{a.title}</span>
          <span className="shrink-0 font-mono text-[11px] text-zinc-400">
            {kind === 'events' ? `${ago(now - a.since)} ago` : `open ${ago(now - a.since)}`}
          </span>
        </summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-600">{a.detail}</pre>
      </details>
    </li>
  );
}

export default async function AdminAlertsPage() {
  let data: Awaited<ReturnType<typeof getOpenAlerts>> | null = null;
  try {
    data = await getOpenAlerts();
  } catch {
    data = null;
  }
  const now = data ? Date.parse(data.asOf) : Date.now();

  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-wider-2 text-[#10c689]">Alerts</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Everything the checks have open. Only critical alerts send an email; warnings live here.
      </p>

      {!data ? (
        <p className="mt-6 text-sm text-zinc-400">The alert record could not be read. That is not the same as no alerts.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {data.sources.map((s) => {
            const label = LABEL[s.source] ?? { title: s.source, note: '' };
            const sorted = [...s.alerts].sort((x, y) => (x.severity === y.severity ? y.since - x.since : x.severity === 'critical' ? -1 : 1));
            const stale = s.updatedAt !== null && now - Date.parse(s.updatedAt) > 60 * 60_000 && s.kind === 'conditions';
            return (
              <section key={s.source} className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {label.title}
                    <span className="ml-2 font-mono text-[11px] font-normal text-zinc-400">{s.alerts.length} {s.kind === 'events' ? 'recent' : 'open'}</span>
                  </h3>
                  <span className={`font-mono text-[11px] ${stale ? 'text-[#b82214]' : 'text-zinc-400'}`}>
                    {s.updatedAt === null ? 'never checked' : `checked ${ago(now - Date.parse(s.updatedAt))} ago${stale ? ', check may be down' : ''}`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{label.note}</p>
                {sorted.length ? (
                  <ul className="mt-3">{sorted.map((a) => <Row key={`${a.id}${a.since}`} a={a} now={now} kind={s.kind} />)}</ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">{s.updatedAt === null ? 'No record yet.' : 'Nothing open.'}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
