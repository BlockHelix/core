import Link from 'next/link';
import { DataAsOf } from '@/components/dashboard/Freshness';
import ReturnChart, { type ReturnSeries } from '@/components/fund/ReturnChart';
import BarRows, { type BarRow } from '@/components/fund/BarRows';
import { fetchAgents, fetchSharePriceHistory, type PublicAgent, type SharePriceHistory } from '@/lib/server/public-fund';
import { chainLabel, explorerAddress } from '@/lib/vault-types';

const GREEN = '#10c689';
const RED = '#b82214';
const COLORS: Record<string, string> = { oUSDC: '#111827', oWBTC: '#f59e0b', BH1: '#9ca3af' };

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const signed = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`;
const longDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function Kpi({ label, value, hint, color }: { label: string; value: string | null; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={value === null ? 'mt-1 text-sm text-gray-400' : 'mt-1 text-2xl font-semibold tabular-nums tracking-tight'} style={{ color: value === null ? undefined : (color ?? '#111827') }}>
        {value ?? 'not measured'}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {note ? <p className="mt-1 text-xs text-gray-500">{note}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-gray-100 py-3 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm leading-relaxed text-gray-800">{children}</dd>
    </div>
  );
}

/** The record, as one dashboard: return, allocation, earnings and risk, then the fact sheet. */
export default async function AgentsRecord() {
  const feed = await fetchAgents();
  const agents = feed?.agents ?? [];
  const asOf = feed?.asOf ?? null;
  const histories = new Map<string, SharePriceHistory | null>(
    await Promise.all(agents.map(async (a) => [a.symbol, await fetchSharePriceHistory(a.symbol)] as const)),
  );

  if (agents.length === 0) {
    return (
      <main className="bg-white">
        <section className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
          <p className="font-mono text-sm text-gray-400">The live record could not be read just now. Nothing is shown rather than a stale figure.</p>
        </section>
      </main>
    );
  }

  const nowT = asOf ? Date.parse(asOf) : Date.now();
  const startOf = (a: PublicAgent) => histories.get(a.symbol)?.startSharePrice ?? 1;
  const returnOf = (a: PublicAgent) => (a.sharePriceLive === null ? null : a.sharePriceLive / startOf(a) - 1);

  const series: ReturnSeries[] = agents
    .map((a) => {
      const h = histories.get(a.symbol);
      const start = startOf(a);
      return {
        symbol: a.symbol,
        color: COLORS[a.symbol] ?? '#6b7280',
        points: (h?.points ?? []).map((p) => ({ t: Date.parse(p.at), r: p.sharePrice / start - 1 })),
        live: a.sharePriceLive === null ? null : { t: nowT, r: a.sharePriceLive / start - 1 },
      };
    })
    .filter((s) => s.points.length > 0);

  const sized = agents.filter((a): a is PublicAgent & { navUsd: number } => a.navUsd !== null);
  const capital = sized.reduce((s, a) => s + a.navUsd, 0);
  const withApy = sized.filter((a) => a.grossCarryApy !== null);
  const apyWeight = withApy.reduce((s, a) => s + a.navUsd, 0);
  const blendedApy = apyWeight > 0 ? withApy.reduce((s, a) => s + a.navUsd * (a.grossCarryApy as number), 0) / apyWeight : null;

  const firstPush = Math.min(...[...histories.values()].flatMap((h) => (h?.points[0] ? [Date.parse(h.points[0].at)] : [])));
  const launched = Number.isFinite(firstPush) ? firstPush : null;
  const daysLive = launched ? Math.floor((nowT - launched) / 86_400_000) : null;

  const books = agents.flatMap((a) => a.books.map((b) => ({ ...b, symbol: a.symbol })));
  const falls = books.filter((b): b is typeof b & { priceFallToLiqPct: number } => typeof b.priceFallToLiqPct === 'number');
  const thinnest = falls.length ? Math.min(...falls.map((b) => b.priceFallToLiqPct)) : null;

  const allocation: BarRow[] = [];
  const earning: BarRow[] = [];
  const unmeasured: string[] = [];
  for (const a of sized) {
    for (const p of a.carryByPosition?.positions ?? []) {
      const usd = p.navShare * a.navUsd;
      if (usd < 1) continue;
      allocation.push({ label: p.market.replace(' (held)', ''), sub: a.symbol, value: usd, display: `${money(usd)} · ${pct(usd / capital, 0)}`, color: COLORS[a.symbol] });
      if (p.carryApy === null) unmeasured.push(`${p.market} (${a.symbol})`);
      else earning.push({ label: p.market.replace(' (held)', ''), sub: `${a.symbol} · ${p.leverage.toFixed(1)}x`, value: p.carryApy, display: pct(p.carryApy), color: p.carryApy >= 0 ? GREEN : RED });
    }
    const idle = (a.carryByPosition?.idleNavShare ?? 0) * a.navUsd;
    if (idle >= 1) allocation.push({ label: 'Cash', sub: a.symbol, value: idle, display: `${money(idle)} · ${pct(idle / capital, 0)}`, color: '#d1d5db' });
  }
  allocation.sort((x, y) => y.value - x.value);
  earning.sort((x, y) => y.value - x.value);

  const risk: BarRow[] = falls
    .sort((x, y) => x.priceFallToLiqPct - y.priceFallToLiqPct)
    .map((b) => ({
      label: b.market,
      sub: `${b.symbol} · LTV ${pct(b.ltv, 0)} of ${pct(b.lltv, 0)}`,
      value: b.priceFallToLiqPct,
      display: `${pct(b.priceFallToLiqPct)} fall`,
      color: b.verdict === 'warn' || b.verdict === 'reversing' ? RED : '#111827',
    }));

  return (
    <main className="bg-gray-50/60">
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.17em] text-gray-400">{'// The record'}</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Oolong</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
          A fund run by software agents. It trades its own capital on Ethereum, and every number on this page is read from the chain.
        </p>
        <p className="mt-2"><DataAsOf asOf={asOf} /></p>

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Capital" value={sized.length ? money(capital) : null} hint={`${agents.length} vaults, own money`} />
          <Kpi label="APY" value={blendedApy === null ? null : pct(blendedApy)} hint="at today's rates, capital-weighted" />
          <Kpi label="Live since" value={launched ? new Date(launched).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null} hint={daysLive !== null ? `${daysLive} days of record` : undefined} />
          <Kpi label="Thinnest buffer" value={thinnest === null ? null : pct(thinnest)} hint="price fall before any liquidation" />
        </div>

        <div className="mt-6 space-y-6">
          <Card
            title="Return since launch"
            note="Each vault's share price against its starting price. Solid points are official on-chain updates; the dashed end is the live price, not yet pushed. oWBTC is measured in bitcoin."
          >
            {series.length ? <ReturnChart series={series} /> : <p className="text-sm text-gray-400">Share price history could not be read just now.</p>}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Where the capital is" note="Equity in each position as a share of all capital, coloured by vault.">
              <BarRows rows={allocation} />
            </Card>
            <Card title="What each position earns" note="Yearly rate on the equity in each position, after borrow cost, at today's rates.">
              <BarRows rows={earning} />
              {unmeasured.length ? <p className="mt-4 text-[11px] text-gray-400">Not measured: {unmeasured.join(', ')}.</p> : null}
            </Card>
          </div>

          <Card title="Room before liquidation" note="How far the collateral price can fall before each loan can be liquidated.">
            <BarRows rows={risk} />
          </Card>

          <Card title="Fact sheet">
            <dl className="-mt-3">
              <Fact label="Manager">Oolong. Software agents find, size and execute positions. A person approves the trades they propose.</Fact>
              <Fact label="Capital">Own capital only. Deposits are closed. {sized.length ? `${money(capital)} across ${agents.length} vaults.` : null}</Fact>
              <Fact label="Track record">{launched ? `Live since ${longDate(launched)}. ${daysLive} days, every share price update on-chain with its transaction.` : 'not measured'}</Fact>
              <Fact label="Strategy">Yield on dollar stablecoins, levered on Morpho lending markets, mostly with Pendle fixed-rate tokens as collateral. The bitcoin vault borrows dollars against its bitcoin and holds yield-bearing dollar tokens.</Fact>
              <Fact label="Chain">{chainLabel(agents[0].chainId)}</Fact>
              <Fact label="Vault contracts">Veda BoringVault, open source. The manager can only make calls on an on-chain allowlist of contracts and arguments. Anything else reverts.</Fact>
              <Fact label="Risk checks">Off-chain monitors watch every position: liquidation buffer, token pegs, the market price against the issuer&rsquo;s stated price, and gas. Trades wait when gas is above 0.2 gwei.</Fact>
              <Fact label="Share price">Pushed on-chain by an updater. Each update can move it by at most 1%, at most once every 6 hours, so one bad price cannot reprice the vault.</Fact>
              <Fact label="Vaults">
                <ul className="space-y-1.5">
                  {agents.map((a) => {
                    const r = returnOf(a);
                    return (
                      <li key={a.symbol} className="flex flex-wrap items-baseline gap-x-3">
                        <Link href={`/record/${a.symbol}`} className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600">{a.name}</Link>
                        <span className="font-mono text-[11px] text-gray-500">
                          {a.navUsd !== null ? money(a.navUsd) : 'not measured'} · {r === null ? 'not measured' : `${signed(r, 2)} since launch`} · {a.grossCarryApy === null ? 'APY not measured' : `${pct(a.grossCarryApy)} APY`}
                        </span>
                        <a href={explorerAddress(a.chainId, a.vault)} target="_blank" rel="noopener noreferrer" className="font-data text-[11px] text-[#10c689] hover:underline">
                          {a.vault.slice(0, 8)}…{a.vault.slice(-4)} ↗
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </Fact>
            </dl>
          </Card>
        </div>
      </section>
    </main>
  );
}
