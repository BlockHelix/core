const connectExample = `Base URL   https://api.blockhelix.tech
Auth       Authorization: Bearer <your API key>
           (service integrations: X-API-Key + X-User-Id)
Reference  https://api.blockhelix.tech/docs   (interactive OpenAPI)`;

const createExample = `POST /vaults
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "chainId": 8453,
  "riskProfileId": "stable-conservative",
  "baseAssetAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "pauserAddress": "0xYourSafe",
  "payoutAddress": "0xYourAddress",
  "platformFeeBps": 100,
  "performanceFeeBps": 1000,
  "vaultName": "My Vault",
  "vaultSymbol": "MYV"
}

// 202 { "deploymentId": "dep_...", "status": "queued" }
// poll GET /vaults/:id until status is "complete"`;

const capabilitiesExample = `GET /vaults/:id/capabilities

// 200 - machine-readable, so an agent can plan trades from the API alone
{
  "riskProfile": "stable-conservative",
  "baseAsset": { "symbol": "USDC", "decimals": 6, "address": "0x8335..." },
  "capabilities": [
    { "protocol": "aave-v3",    "endpoint": "/trade/aave", "method": "POST",
      "actions": ["supply", "withdraw"], "assets": [ { "symbol": "USDC", ... } ] },
    { "protocol": "uniswap-v3", "endpoint": "/trade/swap", "method": "POST",
      "actions": ["swap"], "assets": [ USDC, DAI ], "pairs": [ ["USDC", "DAI"] ] }
  ]
}`;

const tradeExample = `POST /trade/aave
{ "deploymentId": "dep_...", "action": "supply",
  "asset": "0x8335...", "amount": "5000000" }

POST /trade/swap
{ "deploymentId": "dep_...",
  "tokenIn":  "0x8335...", "tokenOut": "0x50c5...",
  "amountIn": "2000000",   "minAmountOut": "1950000000000000000" }

// 202 { "tradeId": "trd_...", "status": "queued", "warnings": [ ... ] }
// 400 if the pair is not in the vault policy, or the vault can't fund it
// poll GET /trade/:id for status + txHash`;

const navExample = `GET /vaults/:vault/nav

// 200 - read live from chain
{
  "sharePrice": "1000000", "nav": "10000000", "totalShares": "10000000",
  "balances": [
    { "symbol": "USDC", "idle": "3000000", "supplied": "5000000", "supplyApy": 0.043 },
    { "symbol": "DAI",  "idle": "2000400000000000000", "supplied": "0", "supplyApy": null }
  ]
}`;

const ENDPOINTS = [
  ['POST /vaults', 'Deploy a policy-guarded vault'],
  ['GET  /vaults', 'List your vaults'],
  ['GET  /vaults/risk-profiles', 'Offered trade-policy profiles'],
  ['GET  /vaults/:id', 'Deployment status and component addresses'],
  ['GET  /vaults/:id/capabilities', 'What this vault can trade (agent discovery)'],
  ['GET  /vaults/:vault/nav', 'Live share price, NAV, and per-token balances'],
  ['POST /trade/aave', 'Supply to / withdraw from Aave v3'],
  ['POST /trade/swap', 'Swap between authorized assets (Uniswap v3)'],
  ['GET  /trade', 'List your trades'],
  ['GET  /trade/:id', 'Trade status, txHash, and failure reason'],
];

export default function DocsContent() {
  return (
    <main className="min-h-screen py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-mono">Docs</p>
            <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 border border-emerald-500/40 text-emerald-700 bg-emerald-50">
              Live
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 font-mono mb-3">BlockHelix API</h1>
          <p className="text-gray-600 text-sm max-w-3xl">
            Deploy a policy-guarded vault, then let an operator or agent trade within it. Every action is
            one API call and is verified on-chain against the vault&apos;s policy. The full interactive
            reference is at{' '}
            <a
              href="https://api.blockhelix.tech/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-500 font-mono text-xs underline underline-offset-2"
            >
              api.blockhelix.tech/docs ↗
            </a>
            .
          </p>
        </header>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">Connect</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {connectExample}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            Get an API key from the dashboard. Pass it as a Bearer token. Service integrations use an
            X-API-Key plus an X-User-Id header to scope calls to an end user.
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">How it works</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Vaults are non-custodial. Every action an operator or agent takes goes through this API and is
            re-verified on-chain against a merkle-authorized policy: only whitelisted protocols, assets, and
            actions execute, and anything else reverts at the contract. Deposits and withdrawals are
            wallet-signed by the depositor; strategist trades are API-driven and bounded by the policy.
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">1) Deploy a vault</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {createExample}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            Pick a risk profile from GET /vaults/risk-profiles. It sets the merkle policy at launch: exactly
            which protocols, actions, and assets the vault will ever allow.
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">2) Discover what it can trade</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {capabilitiesExample}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            An agent reads its authorized protocols, actions, assets (with addresses and decimals), and swap
            pairs, plus the endpoint to call for each. No out-of-band knowledge needed.
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">3) Trade</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {tradeExample}
          </pre>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">4) Read the vault</h2>
          <pre className="bg-gray-900 border border-gray-800 p-4 overflow-x-auto text-xs text-gray-100 font-mono">
            {navExample}
          </pre>
          <p className="text-xs text-gray-500 mt-3">
            Share price, NAV, and per-token balances (idle in the vault vs supplied to Aave), read live from
            chain. Amounts are base units; sharePrice and NAV are in the base asset.
          </p>
        </section>

        <section className="border border-amber-500/30 p-6 mb-6 bg-amber-50 shadow-soft">
          <h2 className="text-lg text-amber-800 font-mono mb-3">Not live yet: risk checks</h2>
          <p className="text-sm text-amber-800/90 leading-relaxed">
            Trades are bounded by the on-chain policy (only whitelisted actions execute). The independent
            risk layer (price impact, slippage validation against an oracle, liquidity and position-health
            checks) is not active yet, and minAmountOut is caller-supplied. Every trade response carries this
            caveat in a warnings field. Do not use with funds you can&apos;t afford to lose.
          </p>
        </section>

        <section className="border border-gray-200 p-6 mb-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-4">Endpoints</h2>
          <div className="space-y-2">
            {ENDPOINTS.map(([ep, desc]) => (
              <div key={ep} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm">
                <code className="text-emerald-700 font-mono text-xs whitespace-pre md:w-72 shrink-0">{ep}</code>
                <span className="text-gray-500 text-xs">{desc}</span>
              </div>
            ))}
          </div>
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

        <section className="border border-gray-200 p-6 bg-white shadow-soft">
          <h2 className="text-lg text-gray-900 font-mono mb-3">Agent-ready today</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            The REST API is built for agents: GET /vaults/:id/capabilities lets an agent discover its
            authorized trades, and every action is a single call bounded by the on-chain policy. An MCP
            server wrapping these tools is on the roadmap. The legacy Solana runtime and its MCP endpoint
            are frozen.
          </p>
        </section>
      </div>
    </main>
  );
}
