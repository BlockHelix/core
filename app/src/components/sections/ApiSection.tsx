import Reveal from '@/components/ui/Reveal';
import { CopyButton } from '@/components/ui/CopyButton';

const CURL_SNIPPET = `curl -X POST https://api.blockhelix.dev/v1/vaults/0x8f3a/trade/swap \\
  -H "Authorization: Bearer <api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"tokenIn":"USDC","tokenOut":"WETH","amount":"25000000000"}'`;

const EM = '#6ee7b7';
const SKY = '#7dd3fc';
const AMBER = '#fcd34d';
const DIM = 'rgba(255,255,255,0.3)';

// Hand-highlighted, static content only.
const CURL_HTML = [
  `<span style="color:${DIM}">$</span> curl -X POST https://api.blockhelix.dev/v1/vaults/0x8f3a/trade/swap \\`,
  `  -H <span style="color:${EM}">"Authorization: Bearer &lt;api-key&gt;"</span> \\`,
  `  -H <span style="color:${EM}">"Content-Type: application/json"</span> \\`,
  `  -d '{ <span style="color:${SKY}">"tokenIn"</span>: <span style="color:${EM}">"USDC"</span>, <span style="color:${SKY}">"tokenOut"</span>: <span style="color:${EM}">"WETH"</span>, <span style="color:${SKY}">"amount"</span>: <span style="color:${AMBER}">"25000000000"</span> }'`,
  ``,
  `<span style="color:${DIM}"># 200 OK · 41ms`,
  `# {`,
  `#   <span style="color:${SKY}">"trade"</span>: <span style="color:${EM}">"25,000 USDC → WETH"</span>,`,
  `#   <span style="color:${SKY}">"decision"</span>: <span style="color:#f87171">"rejected"</span>,`,
  `#   <span style="color:${SKY}">"breached"</span>: <span style="color:${AMBER}">3</span>,`,
  `#   <span style="color:${SKY}">"checks"</span>: {`,
  `#     <span style="color:${SKY}">"venue"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${EM}">"uniswap-v3"</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#2beead">true</span> },`,
  `#     <span style="color:${SKY}">"slippage_bps"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${AMBER}">18</span>, <span style="color:${SKY}">"max"</span>: <span style="color:${AMBER}">50</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#2beead">true</span> },`,
  `#     <span style="color:${SKY}">"price_impact_bps"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${AMBER}">480</span>, <span style="color:${SKY}">"max"</span>: <span style="color:${AMBER}">50</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#f87171">false</span> },`,
  `#     <span style="color:${SKY}">"oracle_deviation_bps"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${AMBER}">34</span>, <span style="color:${SKY}">"max"</span>: <span style="color:${AMBER}">25</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#f87171">false</span> },`,
  `#     <span style="color:${SKY}">"nav_delta_bps"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${AMBER}">-12</span>, <span style="color:${SKY}">"min"</span>: <span style="color:${AMBER}">-5</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#f87171">false</span> },`,
  `#     <span style="color:${SKY}">"exit_liquidity_bps"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${AMBER}">45</span>, <span style="color:${SKY}">"max"</span>: <span style="color:${AMBER}">60</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#2beead">true</span> },`,
  `#     <span style="color:${SKY}">"health_factor"</span>: { <span style="color:${SKY}">"v"</span>: <span style="color:${AMBER}">1.9</span>, <span style="color:${SKY}">"min"</span>: <span style="color:${AMBER}">1.5</span>, <span style="color:${SKY}">"ok"</span>: <span style="color:#2beead">true</span> }`,
  `#   },`,
  `#   <span style="color:${SKY}">"counter_offer"</span>: { <span style="color:${SKY}">"trade"</span>: <span style="color:${EM}">"8,200 USDC → WETH"</span>, <span style="color:${SKY}">"price_impact_bps"</span>: <span style="color:${AMBER}">41</span>, <span style="color:${SKY}">"decision"</span>: <span style="color:#2beead">"passes"</span> }`,
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
              Every trade returns a full risk decision.
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
