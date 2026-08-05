// Two lists, deliberately separated. REQUIRED quotes a real obligation. BETTER is execution
// quality, which no rule compels. Conflating them is how a compliance buyer ends up asking "which
// rule requires this?" about a feature no rule requires, and stops trusting the rest.

const REQUIRED = [
  {
    title: 'An independent risk function',
    body: 'AIFMD requires risk management be separated from portfolio management, and requires you to demonstrate it. Checks inside the strategy code are neither.',
  },
  {
    title: 'Searchable logs of every trade',
    body: 'MiCA made automatically recorded audit logs of all trades and instructions a legal obligation, not a best practice. Generated here, not assembled later.',
  },
  {
    title: 'Five years of policy versions',
    body: 'SEC Rule 204-2 requires every policy version in force over five years, plus the records of each annual review. Versioned on-chain, retrievable by period.',
  },
  {
    title: 'Documented exceptions',
    body: 'Allocator due diligence asks how you escalate a breach. Overrides carry who authorised them and what was rejected.',
  },
];

const BETTER = [
  {
    title: 'Size-aware execution bounds',
    body: 'Simulated price impact and ticks crossed at the size you are trading, not a fixed slippage number chosen by the bot that wants the trade to go through.',
  },
  {
    title: 'Oracle deviation',
    body: 'Spot against TWAP before the trade, fee-exclusive on both sides. A good rate on a dislocated book is the trade you want refused.',
  },
];

function Cards({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-black/[0.06] md:grid-cols-2">
      {items.map((a) => (
        <div key={a.title} className="bg-white p-8">
          <h3 className="text-sm font-medium text-gray-900">{a.title}</h3>
          <p className="mt-2.5 text-[14px] leading-relaxed text-gray-500">{a.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function EvidenceSection() {
  return (
    <section className="border-t border-black/[0.06] bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Evidence, not assertion</p>
          <h2 className="mt-4 text-3xl font-light leading-tight tracking-[-0.02em] text-gray-900 md:text-4xl">
            Prove your automated execution stayed inside policy
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-gray-500">
            AIFMD requires a manager to{' '}
            <span className="text-gray-900">
              &ldquo;functionally and hierarchically separate the functions of risk management
              &hellip; from the functions of portfolio management&rdquo;
            </span>{' '}
            — and to be able to demonstrate it.
          </p>
        </div>

        <p className="mt-14 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          What the rules require
        </p>
        <Cards items={REQUIRED} />

        <p className="mt-12 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          What no rule requires
        </p>
        <Cards items={BETTER} />
      </div>
    </section>
  );
}
