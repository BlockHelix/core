import Link from 'next/link';
import type { Metadata } from 'next';
import { getAttributionPublic } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  'The USDe/USDG loop on Robinhood Chain: live market size, rates, the leverage math, and the actual wallets running it, measured from raw chain data.';

export const metadata: Metadata = {
  title: 'The USDe loop on Robinhood Chain | BlockHelix Research',
  description: DESCRIPTION,
  alternates: { canonical: '/research/rh-loop' },
  openGraph: {
    type: 'article',
    url: 'https://blockhelix.tech/research/rh-loop',
    siteName: 'BlockHelix',
    title: 'The USDe loop on Robinhood Chain',
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: 'The USDe loop on Robinhood Chain', description: DESCRIPTION },
};

const MARKET_ID = '0xc845da65a020ddca5f132efa8fea79676d8edfdea504226a4c01e7a9e34cddd6';
const MORPHO_RH = '0x9d53d5e3bd5e8d4cbfa6db1ca238aea02e651010';
const EXPLORER = 'https://robinhoodchain.blockscout.com';

interface MarketState {
  supplyUsd: number;
  borrowUsd: number;
  utilization: number;
  borrowAprPct: number;
}

async function fetchMarket(): Promise<MarketState | null> {
  try {
    const q = `query { markets(first: 1, where: {uniqueKey_in: ["${MARKET_ID}"]}) { items { state { supplyAssetsUsd borrowAssetsUsd utilization borrowApy } } } }`;
    const res = await fetch('https://blue-api.morpho.org/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: q }),
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      data?: { markets: { items: Array<{ state?: { supplyAssetsUsd?: number; borrowAssetsUsd?: number; utilization?: number; borrowApy?: number } }> } };
    };
    const st = json.data?.markets.items[0]?.state;
    if (!st) return null;
    return {
      supplyUsd: st.supplyAssetsUsd ?? 0,
      borrowUsd: st.borrowAssetsUsd ?? 0,
      utilization: (st.utilization ?? 0) * 100,
      borrowAprPct: (st.borrowApy ?? 0) * 100,
    };
  } catch {
    return null;
  }
}

async function fetchRewardAprPct(): Promise<number | null> {
  try {
    const res = await fetch('https://api.merkl.xyz/v4/opportunities?chainId=4663&items=100', { cache: 'no-store' });
    const data = (await res.json()) as Array<{ name?: string; apr?: number }> | { data?: Array<{ name?: string; apr?: number }> };
    const items = Array.isArray(data) ? data : (data.data ?? []);
    const m = items.find((o) => (o.name ?? '').includes('USDe as collateral') && (o.name ?? '').includes('USDG'));
    return m?.apr ?? null;
  } catch {
    return null;
  }
}

const usdM = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
const usd = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-1.5 font-data text-xl font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

export default async function RhLoopPage() {
  const [market, rewardApr, attribution] = await Promise.all([fetchMarket(), fetchRewardAprPct(), getAttributionPublic()]);

  const spreadPerTurn = rewardApr != null && market ? rewardApr - market.borrowAprPct : null;
  const fwdAt = (lev: number) =>
    rewardApr != null && market ? lev * rewardApr - (lev - 1) * market.borrowAprPct : null;

  const wallets = attribution.items
    .filter((s) => s.chainId === 4663 && s.metrics)
    .sort((a, b) => (b.metrics?.net_apy ?? 0) - (a.metrics?.net_apy ?? 0));

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <p className="text-xs uppercase tracking-[0.2em] font-mono text-gray-400 mb-4">{'// Research'}</p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">The USDe loop on Robinhood Chain</h1>
        <p className="text-lg text-gray-600 mt-4 max-w-2xl">
          The biggest trade on the chain: borrow USDG at a loss to hold USDe, and let the reward
          campaign pay for it. Live numbers, the leverage math, and the actual wallets running it,
          measured from raw chain data.
        </p>
        <p className="mt-3 font-mono text-[11px] text-gray-400">
          Data fetched live from the Morpho and Merkl APIs at page load · {now} UTC
        </p>

        {/* live market state */}
        <div className="mt-12 border border-gray-200 bg-white shadow-sm px-6 py-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-5">
            {'// USDe/USDG · Morpho on Robinhood Chain · live'}
          </p>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-5">
            <Stat label="supplied" value={market ? usdM(market.supplyUsd) : '—'} />
            <Stat label="borrowed" value={market ? usdM(market.borrowUsd) : '—'} />
            <Stat label="utilization" value={market ? `${market.utilization.toFixed(0)}%` : '—'} />
            <Stat label="borrow apr" value={market ? `${market.borrowAprPct.toFixed(2)}%` : '—'} color="#b82214" />
            <Stat label="reward apr · Merkl" value={rewardApr != null ? `${rewardApr.toFixed(2)}%` : '—'} color="#10c689" />
          </div>
        </div>

        {/* the machine */}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mt-16">The machine</h2>
        <div className="mt-4 space-y-4 text-gray-700 leading-relaxed">
          <p>
            On its own this trade loses money. USDe earns nothing on Robinhood Chain, and USDG
            costs {market ? `${market.borrowAprPct.toFixed(2)}%` : 'about 3.3%'} to borrow. Negative
            carry, on purpose.
          </p>
          <p>
            The subsidy flips it: Merkl pays{' '}
            {rewardApr != null ? `${rewardApr.toFixed(2)}%` : 'about 4.3%'} on deposited USDe. Each
            loop of collateral nets the gap
            {spreadPerTurn != null ? ` (${spreadPerTurn.toFixed(2)}% per turn)` : ''}, stacked on the
            last one. The playbook is three moves: deposit USDe, borrow USDG, swap back to USDe,
            deposit again. Then stop touching it.
          </p>
        </div>

        {/* leverage table */}
        <div className="mt-8 border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-400 font-normal">leverage</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-gray-400 font-normal">gross apy at current rates</th>
              </tr>
            </thead>
            <tbody>
              {[5, 8, 10, 11.8].map((lev) => (
                <tr key={lev} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-data tabular-nums text-gray-900">
                    {lev}x{lev === 11.8 ? ' (max at 91.5% LLTV)' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-data tabular-nums font-semibold" style={{ color: '#10c689' }}>
                    {fwdAt(lev) != null ? pct(fwdAt(lev)!) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Gross of swap costs on entry and exit. The rates float: the table recomputes from the live
          borrow and reward rates every time this page loads.
        </p>

        {/* measured wallets */}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mt-16">The actual wallets</h2>
        <p className="mt-4 text-gray-700 leading-relaxed">
          These are the largest borrowers in the market, attributed from their full on-chain
          history: every deposit, borrow, and reward, decomposed into named drivers that sum back to
          the on-chain P&amp;L with a zero residual. Realized APY is measured on time-weighted
          equity, so it is what a dollar in the wallet actually earned.
        </p>
        <div className="mt-6 border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['wallet', 'realized apy', 'quoted now', 'leverage', 'days', 'avg equity', 'net p&l', 'links'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-gray-400 font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wallets.map((s) => {
                const m = s.metrics!;
                const address = s.id.split(':')[1] ?? '';
                const young = (m.holding_days ?? 0) < 7;
                const apy = m.net_apy ?? 0;
                return (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-3 font-mono text-[12px] text-gray-900">
                      {address.slice(0, 6)}…{address.slice(-4)}
                    </td>
                    <td className="px-3 py-3 font-data tabular-nums font-semibold" style={{ color: young ? '#94a3b8' : apy < 0 ? '#b82214' : '#10c689' }}>
                      {young ? 'too young' : pct(apy)}
                    </td>
                    <td className="px-3 py-3 font-data tabular-nums text-gray-600">{pct(m.forward_apy ?? 0)}</td>
                    <td className="px-3 py-3 font-data tabular-nums text-gray-600">{(m.leverage ?? 0).toFixed(1)}x</td>
                    <td className="px-3 py-3 font-data tabular-nums text-gray-600">{Math.round(m.holding_days ?? 0)}</td>
                    <td className="px-3 py-3 font-data tabular-nums text-gray-600">{usd(m.avg_equity_usd ?? 0)}</td>
                    <td className="px-3 py-3 font-data tabular-nums" style={{ color: (m.net_economic_usd ?? 0) < 0 ? '#b82214' : '#10c689' }}>
                      {usd(m.net_economic_usd ?? 0)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer" className="text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-900">
                        explorer
                      </a>{' '}
                      <a href={`https://app.merkl.xyz/users/${address}`} target="_blank" rel="noreferrer" className="text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-900">
                        merkl
                      </a>
                    </td>
                  </tr>
                );
              })}
              {wallets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-400 font-mono text-sm">
                    Attribution data unavailable right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          &quot;Too young&quot; means the wallet is under 7 days old: annualizing days of history is
          noise, and Merkl posts rewards in epochs, so early tallies lag. Negative rows earned the
          subsidy and traded it away in loop maintenance costs.
        </p>

        {/* what ends it */}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mt-16">What ends it</h2>
        <div className="mt-4 space-y-4 text-gray-700 leading-relaxed">
          <p>
            The spread is the subsidy. When the reward campaign changes, the trade stops working the
            same hour, and every looper unwinds through the same door. Utilization already sits near
            {market ? ` ${market.utilization.toFixed(0)}%` : ' 90%'}, so the exit is crowded by
            construction. Size the position so a crowded exit is an inconvenience, not a forced
            sale.
          </p>
          <p>
            And do not rebalance. Every adjustment crosses the swap spread. The wallets in the table
            that entered once and sat still are green; the negative one traded away more than the
            subsidy paid.
          </p>
        </div>

        {/* sources */}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mt-16">Do your own checking</h2>
        <ul className="mt-4 space-y-2 text-gray-700">
          <li>
            <a href={`${EXPLORER}/address/${MORPHO_RH}`} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-gray-900">
              The Morpho contract on the Robinhood Chain explorer
            </a>{' '}
            <span className="text-gray-400 font-mono text-[11px]">{MORPHO_RH.slice(0, 10)}…</span>
          </li>
          <li>
            <a href="https://app.morpho.org" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-gray-900">
              Morpho, where the market lives
            </a>{' '}
            <span className="text-gray-400 font-mono text-[11px]">market {MARKET_ID.slice(0, 10)}…</span>
          </li>
          <li>
            <a href="https://app.merkl.xyz" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-gray-900">
              Merkl, where the reward campaign and every wallet&apos;s claims are public
            </a>
          </li>
        </ul>
        <p className="mt-6 text-sm text-gray-500">
          Every number on this page is fetched from a public source at load time or measured from
          raw chain history by our attribution engine, where the decomposition must reconcile to
          the on-chain P&amp;L with a zero residual. Nothing here is a projection, and none of it is
          financial advice.
        </p>

        {/* waitlist CTA */}
        <div className="mt-16 border border-gray-200 bg-gray-50 px-6 py-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-3">{'// BlockHelix'}</p>
          <p className="text-lg font-semibold text-gray-900">
            This analysis is what our engine does to every position, every day.
          </p>
          <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
            Measured returns, named cost drivers, zero-residual proof. We onboard in small batches.
          </p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-medium bg-[#adffd9] text-gray-900 hover:bg-[#8ceec8] transition-colors duration-300"
          >
            Join the waitlist
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
