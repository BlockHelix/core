import Reveal from '@/components/ui/Reveal';
import { CopyButton } from '@/components/ui/CopyButton';

// Real endpoint, real response, real numbers — these are the actual values returned by the live
// mainnet loop (tx 0x93d6cfb4…). The previous snippet showed a fictional /vaults/0x8f3a/trade/swap
// with invented check names and a counter-offer feature that does not exist.
//
// The framing matters as much as the accuracy: this is not "we trade for you". The trade is the
// operator's; the API is the gate it passes through, and the measured values come back whether it
// passes or not.
const CURL_SNIPPET = `curl -X POST https://api.blockhelix.dev/v1/trade/loop \\
  -H "Authorization: Bearer <api-key>" \\
  -d '{"deploymentId":"dep_a7a0108e","seedUsdc":"49205595","turns":30,
       "targetLtvBps":9000,"maxImpactBps":30,"maxDislocationBps":50,"maxTicksCrossed":2}'`;

const EM = '#6ee7b7';
const SKY = '#7dd3fc';
const AMBER = '#fcd34d';
const DIM = 'rgba(255,255,255,0.3)';

// Hand-highlighted, static content only.
const CURL_HTML = [
  `<span style="color:${DIM}">$</span> curl -X POST https://api.blockhelix.dev/v1/trade/loop \\`,
  `  -H <span style="color:${EM}">"Authorization: Bearer &lt;api-key&gt;"</span> \\`,
  `  -d '{ <span style="color:${SKY}">"deploymentId"</span>: <span style="color:${EM}">"dep_a7a0108e"</span>, <span style="color:${SKY}">"turns"</span>: <span style="color:${AMBER}">30</span>, <span style="color:${SKY}">"targetLtvBps"</span>: <span style="color:${AMBER}">9000</span>,`,
  `       <span style="color:${SKY}">"maxImpactBps"</span>: <span style="color:${AMBER}">30</span>, <span style="color:${SKY}">"maxDislocationBps"</span>: <span style="color:${AMBER}">50</span>, <span style="color:${SKY}">"maxTicksCrossed"</span>: <span style="color:${AMBER}">2</span> }'`,
  ``,
  `<span style="color:${DIM}"># the limits are measured against live state, not trusted from the caller</span>`,
  ``,
  `<span style="color:${DIM}">$</span> curl https://api.blockhelix.dev/v1/trade/trd_784418f3`,
  `<span style="color:${DIM}"># 200 OK`,
  `# {`,
  `#   <span style="color:${SKY}">"status"</span>: <span style="color:#2beead">"confirmed"</span>,`,
  `#   <span style="color:${SKY}">"txHash"</span>: <span style="color:${EM}">"0x93d6cfb4…092631c2"</span>,`,
  `#   <span style="color:${SKY}">"execution"</span>: {`,
  `#     <span style="color:${SKY}">"legs"</span>: <span style="color:${AMBER}">276</span>,`,
  `#     <span style="color:${SKY}">"impactBps"</span>: <span style="color:${AMBER}">0</span>,`,
  `#     <span style="color:${SKY}">"dislocationBps"</span>: <span style="color:${AMBER}">0</span>,`,
  `#     <span style="color:${SKY}">"uniTicksCrossed"</span>: <span style="color:${AMBER}">0</span>,`,
  `#     <span style="color:${SKY}">"slippage"</span>: { <span style="color:${SKY}">"curveBps"</span>: <span style="color:${AMBER}">1</span>, <span style="color:${SKY}">"uniswapBps"</span>: <span style="color:${AMBER}">1</span>, <span style="color:${SKY}">"mintBps"</span>: <span style="color:${AMBER}">1</span> },`,
  `#     <span style="color:${SKY}">"attempt"</span>: <span style="color:${AMBER}">1</span>, <span style="color:${SKY}">"retries"</span>: [],`,
  `#     <span style="color:${SKY}">"projectedLeverage"</span>: <span style="color:${AMBER}">9.618</span>`,
  `#   }`,
  `# }</span>`,
].join('\n');

export default function ApiSection() {
  return (
    <>
      {/* API: the full risk decision */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// The API'}</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-12">
              Every trade returns the numbers it passed on.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border border-gray-800 bg-[#0d0d0d] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 font-mono text-[11px]">
                <span className="text-white/30">bash</span>
                <CopyButton value={CURL_SNIPPET} label="Copy" className="text-white/40 hover:text-white" />
              </div>
              <pre
                className="px-6 py-6 text-[13px] leading-[1.8] font-mono text-gray-400 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: CURL_HTML }}
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
