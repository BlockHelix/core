// The compliance-evidence framing. Sells to an obligation with a deadline (a regulator, an
// auditor, an LP questionnaire) rather than to fear of an incident that operators believe will
// not happen to them. Same product, same enforcement, different buyer trigger.

// Two arguments, deliberately separated. REQUIRED is what a rule actually compels — quoting the
// regulation. BETTER is quality of execution, which no rule compels. Conflating them is what makes
// a compliance buyer ask "which rule requires this?" about a feature no rule requires, and lose
// trust in the parts that ARE required.
const REQUIRED = [
  {
    title: 'An independent risk function',
    body: 'AIFMD requires risk management be separated from portfolio management, and requires you to demonstrate it. Checks inside the strategy code are not a lighter version of that. They are none of it.',
  },
  {
    title: 'Searchable logs of every trade',
    body: 'MiCA made chronological, automatically recorded audit logs of all trades and instructions a legal obligation rather than a best practice. Generated here, not assembled later.',
  },
  {
    title: 'Five years of policy versions',
    body: 'SEC Rule 204-2 requires every policy version in force over the last five years, plus the records documenting each annual review. Versioned on-chain, retrievable by period.',
  },
  {
    title: 'Documented exceptions',
    body: 'Allocator due-diligence asks you to describe the escalation process when a limit is breached. Overrides carry who authorized them and what was rejected. Auditors object to undocumented exceptions, not to exceptions.',
  },
];

const BETTER = [
  {
    title: 'Size-aware execution bounds',
    body: 'Simulated price impact and ticks crossed at the size you are actually trading, not a fixed slippage number chosen by the bot that wants the trade to go through.',
  },
  {
    title: 'Oracle deviation and dislocation',
    body: 'Spot against TWAP before the trade, fee-exclusive on both sides so the comparison means something. A venue quoting a good rate on a dislocated book is the trade you want refused.',
  },
];

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
            Asked how automated execution is constrained, most operators answer with a promise.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-500">
            The rule is already written. AIFMD requires a manager to{' '}
            <span className="text-gray-900">
              &ldquo;functionally and hierarchically separate the functions of risk management
              &hellip; from the functions of portfolio management&rdquo;
            </span>{' '}
            — and to be able to <span className="text-gray-900">demonstrate</span> it. MiCA says the
            same thing about this industry directly: where one entity designs the strategy, executes
            the rebalances and runs the infrastructure, the conflict must be documented and shown to
            a regulator.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-500">
            Risk checks living inside the strategy code are not a lighter version of that
            separation. They are none of it — the same team writes the trades and the limits, and
            the same process runs both.
          </p>
        </div>

        <p className="mt-14 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          What the rules require
        </p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-black/[0.06] md:grid-cols-2">
          {REQUIRED.map((a) => (
            <div key={a.title} className="bg-white p-8">
              <h3 className="text-sm font-medium text-gray-900">{a.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-gray-500">{a.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          What no rule requires, and we do anyway
        </p>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-500">
          An allowlist satisfies the letter of most limit requirements. It answers where capital may
          go, never whether this trade, at this size, against this book, is worth doing. If you have
          to run an independent check regardless, it may as well be one that catches a bad fill.
        </p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-black/[0.06] md:grid-cols-2">
          {BETTER.map((a) => (
            <div key={a.title} className="bg-white p-8">
              <h3 className="text-sm font-medium text-gray-900">{a.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-gray-500">{a.body}</p>
            </div>
          ))}
        </div>

        {/* The timing thesis. Deliberately framed as where this is going, not as the reason to buy
            today — compliance infrastructure sold to a market that has not arrived yet is the
            classic too-early death. Today's buyer has incidents; tomorrow's has examiners. */}
        <div className="mt-16 max-w-3xl border-l-2 border-[#adffd9] pl-6">
          <p className="text-[15px] leading-relaxed text-gray-500">
            On-chain funds are structured offshore today because today&rsquo;s depositors are
            crypto-native. The capital arriving next — bank treasuries, insurers, allocators —
            cannot hold an unregulated vehicle whatever the returns, so the industry moves onshore
            into the UK, Hong Kong, Singapore and MiCA perimeters. The moment it does,{' '}
            <span className="text-gray-900">we have internal controls</span> stops being an
            acceptable answer, and a documented operational-risk framework becomes the price of
            taking the money.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-500">
            We prevent expensive mistakes today. We are the operational-controls layer for
            regulated on-chain funds tomorrow. Same product, two reasons to buy it.
          </p>
        </div>
      </div>
    </section>
  );
}
