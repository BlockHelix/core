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
      <span className="text-[#10c689]">curl</span> https://api.blockhelix.tech/v1/vaults \{'\n'}
      {'  '}-H <span className="text-zinc-400">&quot;Authorization: </span>
      <span className="text-blue-600">Bearer bh_live_...</span>
      <span className="text-zinc-400">&quot;</span> \{'\n'}
      {'  '}-H <span className="text-zinc-400">&quot;Content-Type: application/json&quot;</span> \{'\n'}
      {'  '}-d <span className="text-amber-700">{'\''}</span>
      {'{\n'}
      {'    '}<span className="text-zinc-400">&quot;asset&quot;</span>: <span className="text-amber-700">&quot;USDC&quot;</span>,{'\n'}
      {'    '}<span className="text-zinc-400">&quot;template&quot;</span>: <span className="text-amber-700">&quot;bluechip&quot;</span>,{'\n'}
      {'    '}<span className="text-zinc-400">&quot;operator&quot;</span>: <span className="text-amber-700">&quot;0xYourWallet&quot;</span>{'\n'}
      {'  }'}<span className="text-amber-700">{'\''}</span>
    </>
  );
}

export default function CurlQuickstart() {
  return (
    <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-[#f7f7f8]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-wider-2 text-zinc-400">
          Quickstart · create a vault
        </span>
        <CopyButton value={CURL} label="Copy" />
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-zinc-700">
        <code className="font-data whitespace-pre">
          <Highlighted />
        </code>
      </pre>
    </div>
  );
}
