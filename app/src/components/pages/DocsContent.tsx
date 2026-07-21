const swapExample = `POST /v1/vaults/:id/trade/swap
Content-Type: application/json
Authorization: Bearer <api-key bound to operator wallet>

{
  "tokenIn":  "USDC",
  "tokenOut": "WETH",
  "amount":   "5000000000",
  "maxSlippageBps": 50
}

// 200 { "orderId": "...", "status": "queued" }
// 403 if no matching leaf in the vault's merkle policy`;

const createExample = `POST /v1/vaults
{
  "asset": "USDC",
  "template": "bluechip",
  "operator": "0xYourWallet",
  "managementFeeBps": 100,
  "performanceFeeBps": 1000
}`;

const ENDPOINTS = [
  ['POST /v1/vaults', 'Create a vault from a policy template (root set at launch)'],
  ['POST /v1/vaults/:id/trade/swap', 'Spot swap via CoW Protocol, slippage-capped by policy'],
  ['POST /v1/vaults/:id/yield/deposit', 'Deposit into a whitelisted yield source (Morpho, Aave v3)'],
  ['POST /v1/vaults/:id/yield/withdraw', 'Withdraw from a yield source'],
  ['GET  /v1/vaults/:id/positions', 'Live positions and NAV breakdown'],
  ['GET  /v1/vaults/:id/policy', 'Active merkle leaf set, human-readable'],
  ['POST /v1/vaults/:id/configs', 'Propose a policy change (24h timelock)'],
];

export default function DocsContent() {
  return (
    <main className="min-h-screen py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-mono">Docs</p>
            <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 border border-amber-500/40 text-amber-600 bg-amber-50">
              In development
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 font-mono mb-3">BlockHelix API v1 draft</h1>
          <p className="text-gray-600 text-sm max-w-3xl">
            This is a preview of the trading API we are building. Nothing below is live yet.
            Endpoints, schemas, and auth are subject to change until the testnet release.
            Sign up on the homepage to get started.
          </p>
        </header>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">How it works</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Vaults are non-custodial ERC-4626 contracts. Operators trade through this API, but every
            execution is checked on-chain against a merkle-authorized policy: token pairs, venues,
            slippage, and per-tx caps are all leaf-constrained. Depositors see policy changes 24 hours
            before they execute. Auth is a wallet signature; no signup.
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">1) Create a vault</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {createExample}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            Templates: bluechip · all-yield · balanced · midcap-momentum · perps-midcap (v2) · custom (post-launch).
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">Vault type: Veda</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Vaults deploy Veda&apos;s BoringVault, an institutional, audited, battle-tested vault
            architecture. BlockHelix deploys a pinned version, unmodified:{' '}
            <a
              href="https://github.com/Veda-Labs/boring-vault/tree/bdc38405a02366cb5b25b358aa8e4a0b5ee3ae77"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-500 font-mono text-xs underline underline-offset-2"
            >
              Veda-Labs/boring-vault@bdc38405 ↗
            </a>
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">2) Trade</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {swapExample}
          </pre>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-4">Planned endpoints</h2>
          <div className="space-y-2">
            {ENDPOINTS.map(([ep, desc]) => (
              <div key={ep} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm">
                <code className="text-emerald-700 font-mono text-xs whitespace-pre md:w-72 shrink-0">{ep}</code>
                <span className="text-gray-500 text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-gray-200 p-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">MCP for agents</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            An MCP server exposing vault creation, policy configuration, and trading as tools will ship
            with the testnet release, so AI agents can operate vaults end-to-end. The legacy Solana
            runtime and its MCP endpoint are frozen.
          </p>
        </section>
      </div>
    </main>
  );
}
