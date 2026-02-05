import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './server';
import { registerHostedAgent } from './services/agent-config';

const PORT = process.env.PORT || 3002;
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet'
  ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
  : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

const DEMO_API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (DEMO_API_KEY) {
  registerHostedAgent({
    agentId: 'assistant',
    name: 'General Assistant',
    systemPrompt: `You are a helpful AI assistant. You provide clear, accurate, and concise responses to user queries. You are knowledgeable about a wide range of topics and can help with tasks like:
- Answering questions
- Explaining concepts
- Providing recommendations
- Helping with writing and editing
- Problem solving

Always be helpful, honest, and direct in your responses.`,
    priceUsdcMicro: 50_000,
    model: 'claude-sonnet-4-20250514',
    agentWallet: process.env.AGENT_WALLET_ADDRESS || '',
    vault: process.env.AGENT_VAULT || '',
    registry: process.env.AGENT_REGISTRY || '',
    isActive: true,
    apiKey: DEMO_API_KEY,
  });

  registerHostedAgent({
    agentId: 'defi-advisor',
    name: 'DeFi Advisor',
    systemPrompt: `You are a DeFi expert advisor specializing in:
- Decentralized finance protocols and mechanisms
- Yield farming strategies and risks
- Liquidity provision and impermanent loss
- Token economics and governance
- Smart contract security considerations
- Cross-chain bridges and interoperability

Provide balanced advice that considers both opportunities and risks. Never provide financial advice - only educational information about DeFi concepts and mechanisms.`,
    priceUsdcMicro: 100_000,
    model: 'claude-sonnet-4-20250514',
    agentWallet: process.env.AGENT_WALLET_ADDRESS || '',
    vault: process.env.AGENT_VAULT || '',
    registry: process.env.AGENT_REGISTRY || '',
    isActive: true,
    apiKey: DEMO_API_KEY,
  });

  registerHostedAgent({
    agentId: 'solana-dev',
    name: 'Solana Developer',
    systemPrompt: `You are an expert Solana developer specializing in:
- Anchor framework and Rust smart contracts
- Program Derived Addresses (PDAs) and account model
- Cross-Program Invocation (CPI)
- SPL tokens and associated token accounts
- Transaction construction and optimization
- Solana CLI and development tools
- Security best practices for Solana programs

Provide practical, production-ready code examples and explanations. Focus on secure patterns and Anchor best practices.`,
    priceUsdcMicro: 150_000,
    model: 'claude-sonnet-4-20250514',
    agentWallet: process.env.AGENT_WALLET_ADDRESS || '',
    vault: process.env.AGENT_VAULT || '',
    registry: process.env.AGENT_REGISTRY || '',
    isActive: true,
    apiKey: DEMO_API_KEY,
  });
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`BlockHelix Agent Runtime running on port ${PORT}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health               - Service health`);
  console.log(`  GET  /v1/agents            - List hosted agents`);
  console.log(`  GET  /v1/agent/:id         - Agent details`);
  console.log(`  POST /v1/agent/:id/run     - Run agent (x402 payment required)`);
});
