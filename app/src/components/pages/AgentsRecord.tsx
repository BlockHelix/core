import Link from 'next/link';
import { fetchAgents, type PublicAgent } from '@/lib/server/public-fund';

const usd = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (n: number | null | undefined, d = 2) => (n == null ? '—' : `${(n * 100).toFixed(d)}%`);
const signed = (n: number | null | undefined) =>
  n == null ? '—' : `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;

const GAIN = 'text-[#10c689]';
const LOSS = 'text-[#b82214]';
const tone = (n: number | null | undefined) => (n == null ? 'text-gray-400' : n < 0 ? LOSS : GAIN);

function Verdict({ v }: { v: PublicAgent['books'][number]['verdict'] }) {
  if (!v) return <span className="text-gray-300">—</span>;
  const map = {
    ok: 'border-[#10c689] text-[#10c689]',
    warn: 'border-amber-600 text-amber-700',
    reversing: 'border-[#b82214] text-[#b82214]',
  } as const;
  return (
    <span className={`inline-block rounded-sm border px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider ${map[v]}`}>
      {v}
    </span>
  );
}

function AgentCard({ a }: { a: PublicAgent }) {
  const d = a.drivers;
  const operating = d ? d.carry + d.mark + d.borrow : null;
  return (
    <div className="border-t border-black/[0.08] pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xl font-bold tracking-tight text-gray-900">{a.name}</h3>
          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">
            {a.symbol} · {a.baseAsset ?? '—'} · {a.daysLive ?? '—'} days
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">
          deposits closed
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        <div>
          <p className="font-mono text-2xl tabular-nums tracking-tight text-gray-900">{usd(a.navUsd)}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-400">NAV</p>
        </div>
        <div>
          <p className="font-mono text-2xl tabular-nums tracking-tight text-gray-900">
            {a.sharePriceLive == null ? '—' : a.sharePriceLive.toFixed(6)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-400">
            Share price · live
          </p>
        </div>
        <div>
          <p className="font-mono text-2xl tabular-nums tracking-tight text-gray-900">{pct(a.grossCarryApy)}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-400">
            Forward carry
          </p>
        </div>
        <div>
          <p className={`font-mono text-2xl tabular-nums tracking-tight ${tone(d?.net)}`}>
            {signed(d?.net)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-400">
            Net since launch
          </p>
        </div>
      </div>

      {a.sharePriceOfficial != null && a.sharePriceLive != null ? (
        <p className="mt-4 text-[12px] leading-relaxed text-gray-500">
          The official accountant rate reads{' '}
          <span className="font-mono text-gray-900">{a.sharePriceOfficial.toFixed(6)}</span> and is
          pushed on a delay, so it lags the live figure by{' '}
          <span className="font-mono text-gray-900">
            {(((a.sharePriceOfficial - a.sharePriceLive) / a.sharePriceLive) * 10000).toFixed(0)}bps
          </span>{' '}
          right now. Deposits and redemptions transact at the official one.
          {a.rateWalk ? (
            <>
              {' '}
              It moves at most one band per push, so it needs{' '}
              <span className="font-mono text-gray-900">{a.rateWalk.pushesRemaining}</span> more
              push{a.rateWalk.pushesRemaining === 1 ? '' : 'es'} to get there, landing about{' '}
              <span className="font-mono text-gray-900">
                {new Date(a.rateWalk.convergedAtIso).toISOString().slice(0, 16).replace('T', ' ')}
              </span>{' '}
              UTC.
            </>
          ) : null}
        </p>
      ) : null}

      {d ? (
        <div className="mt-6">
          <p className={`text-[11px] leading-relaxed ${a.driversStale ? 'text-[#b82214]' : 'text-gray-400'}`}>
            {a.driversStale ? 'Stale. ' : ''}
            {a.driversNote ??
              (a.driversAgeHours == null
                ? 'Driver breakdown age unknown.'
                : `Driver breakdown computed ${a.driversAgeHours.toFixed(1)}h ago.`)}
          </p>
        </div>
      ) : null}

      {d ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[12.5px] tabular-nums">
            <thead>
              <tr className="border-b border-black/[0.08] text-left">
                {['Carry', 'Mark', 'Borrow', 'Operating', 'Execution', 'Net'].map((h) => (
                  <th key={h} className="pb-2 pr-6 font-normal text-[10px] uppercase tracking-widest text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`py-2 pr-6 ${tone(d.carry)}`}>{signed(d.carry)}</td>
                <td className={`py-2 pr-6 ${tone(d.mark)}`}>{signed(d.mark)}</td>
                <td className={`py-2 pr-6 ${tone(d.borrow)}`}>{signed(d.borrow)}</td>
                <td className={`py-2 pr-6 ${tone(operating)}`}>{signed(operating)}</td>
                <td className={`py-2 pr-6 ${tone(d.execution)}`}>{signed(d.execution)}</td>
                <td className={`py-2 pr-6 font-bold ${tone(d.net)}`}>{signed(d.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {a.books.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[12.5px] tabular-nums">
            <thead>
              <tr className="border-b border-black/[0.08] text-left">
                {['Book', 'Lev', 'LTV', 'Buffer', 'Oracle', 'Headroom', ''].map((h) => (
                  <th key={h} className="pb-2 pr-6 font-normal text-[10px] uppercase tracking-widest text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.books.map((b) => (
                <tr key={b.market} className="border-b border-black/[0.04]">
                  <td className="py-2 pr-6 text-gray-800">{b.market}</td>
                  <td className="py-2 pr-6 text-gray-500">{b.leverage.toFixed(2)}x</td>
                  <td className="py-2 pr-6 text-gray-500">{(b.ltv * 100).toFixed(2)}%</td>
                  <td className="py-2 pr-6 text-gray-500">{b.bufferPp.toFixed(2)}pp</td>
                  <td className="py-2 pr-6 text-gray-500">{b.oracleKind ?? '—'}</td>
                  <td className={`py-2 pr-6 ${b.verdict === 'warn' ? 'text-amber-700' : 'text-gray-500'}`}>
                    {b.reversalHeadroomPp == null ? '—' : `${b.reversalHeadroomPp.toFixed(2)}pp`}
                  </td>
                  <td className="py-2 pr-6"><Verdict v={b.verdict} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {a.pendingRecovery ? (
        <p className="mt-4 text-[12px] leading-relaxed text-gray-500">
          NAV above carries{' '}
          <span className="font-mono text-gray-900">${a.pendingRecovery.usd.toFixed(2)}</span> of
          markdown on an escrowed redemption. It returns in full on{' '}
          <span className="font-mono text-gray-900">{a.pendingRecovery.byIso.slice(0, 10)}</span> if
          the claim waits, so it is not counted as a trading loss.
        </p>
      ) : null}

      {a.unmodelled.length ? (
        <p className="mt-4 text-[12px] leading-relaxed text-gray-500">
          Not modelled: {a.unmodelled.join('; ')}. These are named rather than scored at zero.
        </p>
      ) : null}
    </div>
  );
}

export default async function AgentsRecord() {
  const data = await fetchAgents();
  const agents = data?.agents ?? [];
  const t = agents.reduce(
    (acc, a) => {
      if (!a.drivers) return acc;
      acc.carry += a.drivers.carry;
      acc.mark += a.drivers.mark;
      acc.borrow += a.drivers.borrow;
      acc.execution += a.drivers.execution;
      acc.net += a.drivers.net;
      return acc;
    },
    { carry: 0, mark: 0, borrow: 0, execution: 0, net: 0 },
  );
  const operating = t.carry + t.mark + t.borrow;
  const navTotal = agents.reduce((n, a) => n + (a.navUsd ?? 0), 0);

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-28 lg:px-8">
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.17em] text-gray-400">
          {'// The record'}
        </p>
        <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
          The strategy earned. The trading lost.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-500">
          Every vault we run, live from Ethereum mainnet. {usd(navTotal, 0)} of our own capital.
          The positions produced <span className={GAIN}>{signed(operating)}</span> of operating
          profit and execution cost <span className={LOSS}>{signed(t.execution)}</span>. Both
          numbers come out of the same engine, and it is the second one that is the point.
        </p>
        <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-gray-400">
          No outside money. Deposits are closed on every vault below and there is no fee. This is a
          record of what our own book did, not an offer or an invitation.
        </p>

        {agents.length === 0 ? (
          <p className="mt-16 border-t border-black/[0.08] pt-8 font-mono text-sm text-gray-400">
            The live record could not be read just now. Nothing is shown rather than a stale figure.
          </p>
        ) : (
          <>
            <div className="mt-14 overflow-x-auto border-t border-black/[0.08] pt-8">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                All vaults, summed
              </p>
              <table className="w-full border-collapse font-mono text-[13px] tabular-nums">
                <tbody>
                  <tr className="border-b border-black/[0.06]">
                    <td className="py-2 pr-6 text-gray-500">Carry earned</td>
                    <td className={`py-2 text-right ${tone(t.carry)}`}>{signed(t.carry)}</td>
                  </tr>
                  <tr className="border-b border-black/[0.06]">
                    <td className="py-2 pr-6 text-gray-500">Collateral mark</td>
                    <td className={`py-2 text-right ${tone(t.mark)}`}>{signed(t.mark)}</td>
                  </tr>
                  <tr className="border-b border-black/[0.06]">
                    <td className="py-2 pr-6 text-gray-500">Borrow paid</td>
                    <td className={`py-2 text-right ${tone(t.borrow)}`}>{signed(t.borrow)}</td>
                  </tr>
                  <tr className="border-b border-black/[0.08]">
                    <td className="py-2 pr-6 font-medium text-gray-800">Operating profit</td>
                    <td className={`py-2 text-right font-medium ${tone(operating)}`}>{signed(operating)}</td>
                  </tr>
                  <tr className="border-b border-black/[0.06]">
                    <td className="py-2 pr-6 text-gray-500">Execution cost</td>
                    <td className={`py-2 text-right ${tone(t.execution)}`}>{signed(t.execution)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6 font-bold text-gray-900">Net</td>
                    <td className={`py-3 text-right font-bold ${tone(t.net)}`}>{signed(t.net)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-4 max-w-xl text-[12px] leading-relaxed text-gray-500">
                Drivers sum to the change in NAV; the gap is a failable residual and it is zero on
                every book. Carry is the collateral&rsquo;s scheduled accretion, mark its deviation
                from that schedule, execution what it cost to get in and out.
              </p>
            </div>

            <div className="mt-16 flex flex-col gap-14">
              {agents.map((a) => (
                <AgentCard key={a.vault} a={a} />
              ))}
            </div>
          </>
        )}

        <div className="mt-20 border-t border-black/[0.08] pt-8">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">How to read the risk table</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray-500">
            Most of these books price collateral with a linear-discount oracle, which walks toward
            par and cannot fall. On those, a fall to liquidation is not the risk: the buffer only
            widens while the oracle outruns the debt, and that race turns at a borrow rate specific
            to each market. Headroom is the distance to that rate. It is why a book with a 5pp
            buffer can be fine while one with a 31pp buffer carries the warning.
          </p>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray-500">
            Figures refresh every five minutes from mainnet. Anything we cannot measure is named
            rather than scored, because a zero in an unmeasured row reads as healthy.
          </p>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-gray-400">
            {data?.asOf ? `Read ${new Date(data.asOf).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}
            {' · '}
            <Link href="/" className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600">
              blockhelix
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
