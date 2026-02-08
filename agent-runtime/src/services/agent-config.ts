import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import type { AgentConfig, OnChainAgentMetadata } from '../types';
import { agentStorage } from './storage';
import { FACTORY_PROGRAM_ID, RPC_URL } from '../config';

const DEFAULT_PROMPT = process.env.DEFAULT_AGENT_PROMPT || 'You are a helpful AI assistant.';
const DEFAULT_PRICE = parseInt(process.env.DEFAULT_AGENT_PRICE || '50000', 10);
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

export async function registerHostedAgent(config: AgentConfig, ownerWallet?: string): Promise<void> {
  await agentStorage.create(config, ownerWallet || config.operator);
  console.log(`[config] Registered hosted agent: ${config.agentId} (${config.name})`);
}

export function getHostedAgent(agentId: string): AgentConfig | undefined {
  const stored = agentStorage.get(agentId);
  return stored || undefined;
}

export function getAllHostedAgents(): AgentConfig[] {
  return agentStorage.getAll();
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
  const idlPath = process.env.FACTORY_IDL_PATH || `${process.cwd()}/target/idl/agent_factory.json`;
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
      operator: account.operator.toBase58(),
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

function onChainToAgentConfig(onChain: OnChainAgentMetadata): AgentConfig {
  return {
    agentId: onChain.agentId.toString(),
    name: onChain.name,
    systemPrompt: DEFAULT_PROMPT,
    priceUsdcMicro: DEFAULT_PRICE,
    model: DEFAULT_MODEL,
    operator: onChain.operator,
    vault: onChain.vault,
    registry: onChain.registry,
    isActive: onChain.isActive,
    apiKey: API_KEY,
  };
}

export async function getAgentConfig(agentId: string): Promise<AgentConfig | null> {
  // First check local storage (for hosted agents with custom config)
  // Use async getter to reload from S3 if not in memory (handles container replacement)
  const hosted = await agentStorage.getAsync(agentId);
  if (hosted) return hosted;

  // Try to load from on-chain by numeric ID
  // CRITICAL: Only treat as numeric if the ENTIRE string is a valid integer
  // parseInt("9gdE...", 10) returns 9 which would load the wrong agent!
  const numericId = parseInt(agentId, 10);
  if (!isNaN(numericId) && numericId.toString() === agentId) {
    const onChain = await loadAgentFromChain(numericId);
    if (onChain && onChain.isActive) {
      return onChainToAgentConfig(onChain);
    }
  }

  // Check if agentId is "default"
  if (agentId === 'default') {
    const defaultWallet = process.env.DEFAULT_AGENT_WALLET;
    if (defaultWallet && API_KEY) {
      return {
        agentId: 'default',
        name: 'Default Agent',
        systemPrompt: DEFAULT_PROMPT,
        priceUsdcMicro: DEFAULT_PRICE,
        model: DEFAULT_MODEL,
        operator: defaultWallet,
        vault: process.env.DEFAULT_AGENT_VAULT || '',
        registry: process.env.DEFAULT_AGENT_REGISTRY || '',
        isActive: true,
        apiKey: API_KEY,
      };
    }
  }

  return null;
}

export async function getAllAgentsFromChain(): Promise<OnChainAgentMetadata[]> {
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
    const factoryAccount = await (program.account as any).factoryState.fetch(factoryKey);
    const agentCount = (factoryAccount.agentCount as anchor.BN).toNumber();

    const agents: OnChainAgentMetadata[] = [];
    for (let i = 0; i < agentCount; i++) {
      const agent = await loadAgentFromChain(i);
      if (agent) agents.push(agent);
    }

    return agents;
  } catch (err) {
    console.error('[config] Failed to load agents from chain:', err instanceof Error ? err.message : err);
    return [];
  }
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
      operator: defaultAgentWallet,
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
