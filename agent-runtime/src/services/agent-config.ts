import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import type { AgentConfig, OnChainAgentMetadata } from '../types';

const FACTORY_PROGRAM_ID = new PublicKey(
  process.env.FACTORY_PROGRAM_ID || '7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j'
);
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

const hostedAgentConfigs: Map<string, AgentConfig> = new Map();

export function registerHostedAgent(config: AgentConfig): void {
  hostedAgentConfigs.set(config.agentId, config);
  console.log(`[config] Registered hosted agent: ${config.agentId} (${config.name})`);
}

export function getHostedAgent(agentId: string): AgentConfig | undefined {
  return hostedAgentConfigs.get(agentId);
}

export function getAllHostedAgents(): AgentConfig[] {
  return Array.from(hostedAgentConfigs.values());
}

function getFactoryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    FACTORY_PROGRAM_ID
  );
  return pda;
}

function getAgentMetadataPda(factoryKey: PublicKey, agentId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), factoryKey.toBuffer(), new anchor.BN(agentId).toArrayLike(Buffer, 'le', 8)],
    FACTORY_PROGRAM_ID
  );
  return pda;
}

let cachedIdl: anchor.Idl | null = null;

function loadFactoryIdl(): anchor.Idl {
  if (cachedIdl) return cachedIdl;
  const idlPath = process.env.FACTORY_IDL_PATH || `${process.cwd()}/../target/idl/agent_factory.json`;
  cachedIdl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  return cachedIdl!;
}

export async function loadAgentFromChain(agentId: number): Promise<OnChainAgentMetadata | null> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const idl = loadFactoryIdl();
    const provider = new anchor.AnchorProvider(
      connection,
      { publicKey: PublicKey.default, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs },
      { commitment: 'confirmed' }
    );
    const program = new anchor.Program(idl, provider);

    const factoryKey = getFactoryPda();
    const metadataPda = getAgentMetadataPda(factoryKey, agentId);

    const account = await (program.account as any).agentMetadata.fetch(metadataPda);

    return {
      factory: account.factory.toBase58(),
      agentWallet: account.agentWallet.toBase58(),
      vault: account.vault.toBase58(),
      registry: account.registry.toBase58(),
      shareMint: account.shareMint.toBase58(),
      name: account.name,
      githubHandle: account.githubHandle,
      endpointUrl: account.endpointUrl,
      agentId: (account.agentId as anchor.BN).toNumber(),
      createdAt: (account.createdAt as anchor.BN).toNumber(),
      isActive: account.isActive,
    };
  } catch (err) {
    console.error(`[config] Failed to load agent ${agentId} from chain:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getAgentConfig(agentId: string): Promise<AgentConfig | null> {
  const hosted = hostedAgentConfigs.get(agentId);
  if (hosted) return hosted;

  const numericId = parseInt(agentId, 10);
  if (isNaN(numericId)) return null;

  const onChain = await loadAgentFromChain(numericId);
  if (!onChain || !onChain.isActive) return null;

  const hosted2 = hostedAgentConfigs.get(onChain.agentWallet);
  if (hosted2) return hosted2;

  return null;
}

export function initDefaultAgents(): void {
  const defaultAgentPrompt = process.env.DEFAULT_AGENT_PROMPT;
  const defaultAgentPrice = process.env.DEFAULT_AGENT_PRICE;
  const defaultAgentWallet = process.env.DEFAULT_AGENT_WALLET;
  const defaultAgentVault = process.env.DEFAULT_AGENT_VAULT;
  const defaultAgentRegistry = process.env.DEFAULT_AGENT_REGISTRY;

  const defaultAgentApiKey = process.env.DEFAULT_AGENT_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (defaultAgentPrompt && defaultAgentWallet && defaultAgentApiKey) {
    registerHostedAgent({
      agentId: 'default',
      name: 'Default Agent',
      systemPrompt: defaultAgentPrompt,
      priceUsdcMicro: defaultAgentPrice ? parseInt(defaultAgentPrice, 10) : 100_000,
      model: 'claude-sonnet-4-20250514',
      agentWallet: defaultAgentWallet,
      vault: defaultAgentVault || '',
      registry: defaultAgentRegistry || '',
      isActive: true,
      apiKey: defaultAgentApiKey,
    });
  }

  const agentConfigsJson = process.env.AGENT_CONFIGS;
  if (agentConfigsJson) {
    try {
      const configs: AgentConfig[] = JSON.parse(agentConfigsJson);
      for (const config of configs) {
        registerHostedAgent(config);
      }
    } catch (err) {
      console.error('[config] Failed to parse AGENT_CONFIGS:', err);
    }
  }
}
