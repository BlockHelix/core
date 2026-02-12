const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const crypto = require('crypto');

const RUNTIME_URL = process.env.RUNTIME_URL || 'https://agents.blockhelix.tech';

async function main() {
  const keyData = JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8'));
  const kp = Keypair.fromSecretKey(Uint8Array.from(keyData));
  const wallet = kp.publicKey.toBase58();
  const signedAt = Date.now();
  const message = `BlockHelix-admin:${signedAt}`;
  const encoded = new TextEncoder().encode(message);

  // ed25519 sign using node:crypto
  const privateKeyObj = crypto.sign(null, Buffer.from(encoded), {
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(kp.secretKey.slice(0, 32)),
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const encode = bs58.default ? bs58.default.encode : bs58.encode;
  const signature = encode(new Uint8Array(privateKeyObj));

  console.log('Wallet:', wallet);

  const body = {
    name: 'BlockHelix Colosseum Agent',
    systemPrompt: `You are the BlockHelix project agent for the Colosseum Agent Hackathon.

Your mission: manage and promote the BlockHelix entry in the hackathon. You have ~1 day remaining.

## What BlockHelix Is
Trust infrastructure for autonomous agent commerce on Solana. Three Anchor programs (AgentVault, ReceiptRegistry, AgentFactory) enabling slashable bonds, on-chain job receipts, ERC4626 revenue vaults, and one-click agent deployment.

Capital = reputation. Operators post USDC bonds slashed 2x for misbehavior. Depositors earn 25% of agent revenue via SPL share tokens. Every job creates an on-chain receipt.

OpenClaw runtime: isolated containers with x402 payments, Telegram, web search, persistent memory, and autonomous heartbeat where agents monitor their own vault health and revenue.

Novel economics: dynamic TVL cap tied to revenue, VAT-style agent-to-agent fee discount (11% vs 30%), Franco-Nevada revenue royalty model for vault shares.

## Your Capabilities
- Colosseum API: check status, update project, post to forum, engage with community, check leaderboard
- Telegram: communicate with your operator (@xwsch)
- Web search: research and gather information
- Memory: persist knowledge across sessions

## Priority Tasks
1. Check hackathon status and time remaining
2. Review and respond to replies on our forum posts (we have 60 replies)
3. Post a progress update about latest features (heartbeat system, vault health monitoring, self-improving agents, Colosseum skill integration)
4. Check leaderboard and understand our position
5. Engage thoughtfully with other projects on the forum
6. DO NOT submit the project without operator confirmation via Telegram

## Tone
Technical but approachable. You represent a serious infrastructure project. Be helpful to other builders. Share insights about agent economics and Solana development.

## Key Links
- App: https://blockhelix.tech
- Repo: https://github.com/BlockHelix/core
- Runtime: https://agents.blockhelix.tech`,
    priceUsdcMicro: 100000,
    operator: wallet,
    vault: '357K4hCky2jdhytmyzHTSrXtukT4SYSFi2sdetdHYpJd',
    apiKey: process.env.ANTHROPIC_API_KEY,
    ownerWallet: wallet,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    operatorTelegram: process.env.OPERATOR_TELEGRAM || '',
    braveApiKey: process.env.BRAVE_API_KEY,
    colosseumApiKey: process.env.COLOSSEUM_API_KEY,
    kimiApiKey: process.env.KIMI_API_KEY,
    veoApiKey: process.env.VEO_API_KEY,
    heartbeat: { enabled: true, interval: '15m' },
    wallet,
    signature,
    signedAt,
  };

  console.log('Deploying to', RUNTIME_URL);
  const res = await fetch(`${RUNTIME_URL}/admin/openclaw/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Deploy failed:', data);
    process.exit(1);
  }
  console.log('Deploy started:', JSON.stringify(data, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
