'use client';

import { CopyButton } from '@/components/ui/CopyButton';

const CURL = `curl https://api.blockhelix.tech/v1/vaults \\
  -H "Authorization: Bearer bh_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "asset": "USDC",
    "template": "bluechip",
    "operator": "0xYourWallet"
  }'`;

// Syntax-lite highlighting: header keys, the bearer scheme, and the endpoint.
function Highlighted() {
  return (
    <>
      <span className="text-emerald-400">curl</span> https://api.blockhelix.tech/v1/vaults \{'\n'}
      {'  '}-H <span className="text-white/50">&quot;Authorization: </span>
      <span className="text-cyan-300">Bearer bh_live_...</span>
      <span className="text-white/50">&quot;</span> \{'\n'}
      {'  '}-H <span className="text-white/50">&quot;Content-Type: application/json&quot;</span> \{'\n'}
      {'  '}-d <span className="text-amber-300">{'\''}</span>
      {'{\n'}
      {'    '}<span className="text-white/50">&quot;asset&quot;</span>: <span className="text-amber-300">&quot;USDC&quot;</span>,{'\n'}
      {'    '}<span className="text-white/50">&quot;template&quot;</span>: <span className="text-amber-300">&quot;bluechip&quot;</span>,{'\n'}
      {'    '}<span className="text-white/50">&quot;operator&quot;</span>: <span className="text-amber-300">&quot;0xYourWallet&quot;</span>{'\n'}
      {'  }'}<span className="text-amber-300">{'\''}</span>
    </>
  );
}

export default function CurlQuickstart() {
  return (
    <div className="border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-wider-2 text-white/40">
          Quickstart · create a vault
        </span>
        <CopyButton value={CURL} label="Copy" />
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-white/80">
        <code className="font-data whitespace-pre">
          <Highlighted />
        </code>
      </pre>
    </div>
  );
}
