import ArbDesk from '@/components/admin/ArbDesk';

export const metadata = { title: 'Arb desk | BlockHelix Admin' };

export default function AdminArbPage() {
  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-wider-2 text-[#10c689]">Arb desk</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Base tokenized-stock pools against Hyperliquid perps: what the bots make, the gap right now, and the recorder feeding the backtest.
      </p>
      <div className="mt-6">
        <ArbDesk />
      </div>
    </div>
  );
}
