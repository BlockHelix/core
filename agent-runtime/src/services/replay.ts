import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { agentStorage } from './storage';
import type { AgentConfig, OnChainAgentMetadata } from '../types';

const FACTORY_PROGRAM_ID = new PublicKey(
  process.env.FACTORY_PROGRAM_ID || '7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j'
);
const VAULT_PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || 'HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS'
);
const REGISTRY_PROGRAM_ID = new PublicKey(
  process.env.REGISTRY_PROGRAM_ID || 'jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9'
);
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

const DEFAULT_PROMPT = process.env.DEFAULT_AGENT_PROMPT || 'You are a helpful AI assistant.';
const DEFAULT_PRICE = parseInt(process.env.DEFAULT_AGENT_PRICE || '50000', 10);
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_API_KEY = process.env.DEFAULT_AGENT_API_KEY || process.env.ANTHROPIC_API_KEY || '';

function loadIdl(idlPath: string): anchor.Idl {
  return JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
}

function getReadOnlyProvider(): anchor.AnchorProvider {
  const connection = new Connection(RPC_URL, 'confirmed');
  return new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: 'confirmed' }
  );
}

export interface ReplayStats {
  agentsSynced: number;
  agentsSkipped: number;
  vaultStats: { agentId: string; tvl: number; revenue: number; jobs: number }[];
  errors: string[];
}

export async function replayFromChain(): Promise<ReplayStats> {
  const stats: ReplayStats = { agentsSynced: 0, agentsSkipped: 0, vaultStats: [], errors: [] };

  console.log('[replay] Starting on-chain replay...');

  const provider = getReadOnlyProvider();
  const connection = provider.connection;

  let factoryProgram: anchor.Program;
  try {
    const factoryIdl = loadIdl(
      process.env.FACTORY_IDL_PATH || `${process.cwd()}/../target/idl/agent_factory.json`
    );
    factoryProgram = new anchor.Program(factoryIdl, provider);
  } catch (err) {
    const msg = `Failed to load factory IDL: ${err instanceof Error ? err.message : err}`;
    console.error(`[replay] ${msg}`);
    stats.errors.push(msg);
    return stats;
  }

  let vaultProgram: anchor.Program | null = null;
  try {
    const vaultIdl = loadIdl(
      process.env.VAULT_IDL_PATH || `${process.cwd()}/../target/idl/agent_vault.json`
    );
    vaultProgram = new anchor.Program(vaultIdl, provider);
  } catch {
    console.warn('[replay] Could not load vault IDL, skipping vault stats');
  }

  // 1. Fetch all agents from factory
  let agentAccounts: any[];
  try {
    agentAccounts = await (factoryProgram.account as any).agentMetadata.all();
    console.log(`[replay] Found ${agentAccounts.length} agents on-chain`);
  } catch (err) {
    const msg = `Failed to fetch agents from chain: ${err instanceof Error ? err.message : err}`;
    console.error(`[replay] ${msg}`);
    stats.errors.push(msg);
    return stats;
  }

  // 2. Sync each agent into local storage
  for (const account of agentAccounts) {
    const onChain = account.account as any;
    const agentId = onChain.agentId?.toString?.() ?? onChain.agentId;
    const name = onChain.name as string;
    const operator = (onChain.operator as PublicKey).toBase58();
    const vault = (onChain.vault as PublicKey).toBase58();
    const registry = (onChain.registry as PublicKey).toBase58();

    const existing = agentStorage.get(agentId.toString());
    if (existing) {
      console.log(`[replay] Agent ${agentId} (${name}) already in storage, skipping`);
      stats.agentsSkipped++;
      continue;
    }

    const config: AgentConfig = {
      agentId: agentId.toString(),
      name,
      systemPrompt: DEFAULT_PROMPT,
      priceUsdcMicro: DEFAULT_PRICE,
      model: DEFAULT_MODEL,
      operator,
      vault,
      registry,
      isActive: onChain.isActive ?? true,
      apiKey: DEFAULT_API_KEY,
    };

    agentStorage.create(config, operator);
    console.log(`[replay] Synced agent ${agentId} (${name}) from chain`);
    stats.agentsSynced++;
  }

  // 3. Pull vault stats for each agent
  if (vaultProgram) {
    for (const account of agentAccounts) {
      const onChain = account.account as any;
      const agentId = onChain.agentId?.toString?.() ?? onChain.agentId;
      const vaultPubkey = onChain.vault as PublicKey;

      try {
        const vaultData = await (vaultProgram.account as any).vaultState.fetch(vaultPubkey);
        const v = vaultData as any;

        const vaultUsdcAccount = v.vaultUsdcAccount as PublicKey;
        let tvl = 0;
        try {
          const balance = await connection.getTokenAccountBalance(vaultUsdcAccount);
          tvl = parseFloat(balance.value.amount) / 1_000_000;
        } catch { /* token account may not exist */ }

        const revenue = (v.totalRevenue as anchor.BN).toNumber() / 1_000_000;
        const jobs = (v.totalJobs as anchor.BN).toNumber();

        stats.vaultStats.push({ agentId: agentId.toString(), tvl, revenue, jobs });
        console.log(`[replay] Vault ${agentId}: TVL=$${tvl.toFixed(2)} revenue=$${revenue.toFixed(2)} jobs=${jobs}`);
      } catch {
        // vault may not be initialized
      }
    }
  }

  console.log(`[replay] Complete: ${stats.agentsSynced} synced, ${stats.agentsSkipped} skipped, ${stats.errors.length} errors`);
  return stats;
}
