// The category-definition section. This is the strongest available framing because it does not ask
// the reader to believe a new idea — it points at a mature TradFi category and says on-chain is
// missing it. Charles River runs $36T. Nobody argues about whether pre-trade compliance is needed;
// they argue about which vendor. That is a far better argument to be having.
//
// Deliberately does NOT claim regulation mandates us. Charles River is not mandated either. It is
// the thing you buy because trading without it is unprofessional.

const TRADFI = [
  {
    layer: 'Custody',
    tradfi: 'State Street, BNY, Northern Trust',
    onchain: 'Fireblocks, Anchorage, Fordefi',
    status: 'solved',
  },
  {
    layer: 'Fund administration',
    tradfi: 'Citco, SS&C',
    onchain: 'Veda, Lagoon, Enzyme, IPOR',
    status: 'solved',
  },
  {
    layer: 'Pre-trade compliance',
    tradfi: 'Charles River, Aladdin, SimCorp',
    onchain: 'allowlists',
    status: 'missing',
  },
  {
    layer: 'Execution cost analysis',
    tradfi: 'Virtu, Abel Noser, Bloomberg',
    onchain: 'nothing',
    status: 'missing',
  },
];

export default function CategorySection() {
  return (
    <section className="border-t border-black/[0.06] bg-[#fafafa] py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">The missing layer</p>
          <h2 className="mt-4 text-3xl font-light leading-tight tracking-[-0.02em] text-gray-900 md:text-4xl">
            No institutional manager trades without pre-trade compliance.
            <span className="text-zinc-400"> On-chain, almost everyone does.</span>
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-gray-500">
            Charles River checks every order against the mandate before it leaves the desk, across
            roughly 300 managers and{' '}
            <span className="text-gray-900">$36 trillion in assets</span>.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-500">
            On-chain rebuilt custody. It rebuilt fund administration. It has not rebuilt the layer
            that decides whether an order should be sent at all — the closest thing is an allowlist,
            which answers where capital may go and never whether the trade is worth doing.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider-2 text-zinc-400">
                <th className="pb-3 font-medium">Layer</th>
                <th className="pb-3 font-medium">Traditional finance</th>
                <th className="pb-3 font-medium">On-chain</th>
              </tr>
            </thead>
            <tbody className="font-data text-sm">
              {TRADFI.map((r) => (
                <tr key={r.layer} className={r.status === 'missing' ? 'text-gray-900' : 'text-zinc-400'}>
                  <td className="border-t border-black/[0.06] py-4 pr-6">{r.layer}</td>
                  <td className="border-t border-black/[0.06] py-4 pr-6">{r.tradfi}</td>
                  <td className="border-t border-black/[0.06] py-4">
                    {r.onchain}
                    {r.status === 'missing' && (
                      <span className="ml-3 rounded-md bg-[#adffd9] px-1.5 py-0.5 text-[11px] font-medium text-gray-900">
                        gap
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-gray-500">
          We build those two rows. The checks run before the trade is signed, the vault enforces
          the bounds on-chain, and what happened is logged where an auditor can read it.
        </p>
      </div>
    </section>
  );
}
