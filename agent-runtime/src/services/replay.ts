import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { agentStorage } from './storage';
import type { AgentConfig } from '../types';
import { FACTORY_PROGRAM_ID, RPC_URL } from '../config';

const DEFAULT_PROMPT = process.env.DEFAULT_AGENT_PROMPT || 'You are a helpful AI assistant.';
const DEFAULT_PRICE = parseInt(process.env.DEFAULT_AGENT_PRICE || '50000', 10);
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_API_KEY = process.env.DEFAULT_AGENT_API_KEY || process.env.ANTHROPIC_API_KEY || '';

const AGENT_METADATA_DISCRIMINATOR = Buffer.from([106, 95, 194, 10, 53, 133, 159, 163]);

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
  errors: string[];
}

export async function replayFromChain(): Promise<ReplayStats> {
  const stats: ReplayStats = { agentsSynced: 0, agentsSkipped: 0, errors: [] };

  console.log('[replay] Starting on-chain replay...');

  const provider = getReadOnlyProvider();

  let factoryProgram: anchor.Program;
  try {
    const factoryIdl = loadIdl(
      process.env.FACTORY_IDL_PATH || `${process.cwd()}/target/idl/agent_factory.json`
    );
    factoryProgram = new anchor.Program(factoryIdl, provider);
  } catch (err) {
    const msg = `Failed to load factory IDL: ${err instanceof Error ? err.message : err}`;
    console.error(`[replay] ${msg}`);
    stats.errors.push(msg);
    return stats;
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

    await agentStorage.create(config, operator);
    console.log(`[replay] Synced agent ${agentId} (${name}) from chain`);
    stats.agentsSynced++;
  }

  console.log(`[replay] Complete: ${stats.agentsSynced} synced, ${stats.agentsSkipped} skipped, ${stats.errors.length} errors`);
  return stats;
}

let subscriptionId: number | null = null;

export function subscribeToFactory(): void {
  try {
    const wsRpcUrl = process.env.WS_RPC_URL || RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    if (!wsRpcUrl.startsWith('ws')) {
      console.log('[factory-ws] No WebSocket RPC configured, skipping subscription');
      return;
    }
    const connection = new Connection(RPC_URL, { commitment: 'confirmed', wsEndpoint: wsRpcUrl });

    let factoryProgram: anchor.Program;
    try {
      const factoryIdl = loadIdl(
        process.env.FACTORY_IDL_PATH || `${process.cwd()}/target/idl/agent_factory.json`
      );
      const provider = getReadOnlyProvider();
      factoryProgram = new anchor.Program(factoryIdl, provider);
    } catch (err) {
      console.error('[factory-ws] Failed to load IDL, skipping subscription:', err instanceof Error ? err.message : err);
      return;
    }

    console.log('[factory-ws] Subscribing to factory program:', FACTORY_PROGRAM_ID.toBase58());

  subscriptionId = connection.onProgramAccountChange(
    FACTORY_PROGRAM_ID,
    async (accountInfo, context) => {
      const data = accountInfo.accountInfo.data;
      if (!data || data.length < 8) return;

      const disc = data.subarray(0, 8);
      if (!disc.equals(AGENT_METADATA_DISCRIMINATOR)) return;

      try {
        const decoded = (factoryProgram.coder.accounts as any).decode('AgentMetadata', data);
        const agentId = decoded.agentId?.toString?.() ?? decoded.agentId;
        const name = decoded.name as string;
        const operator = (decoded.operator as PublicKey).toBase58();

        const existing = agentStorage.get(agentId.toString());
        if (existing) return;

        const config: AgentConfig = {
          agentId: agentId.toString(),
          name,
          systemPrompt: DEFAULT_PROMPT,
          priceUsdcMicro: DEFAULT_PRICE,
          model: DEFAULT_MODEL,
          operator,
          vault: (decoded.vault as PublicKey).toBase58(),
          registry: (decoded.registry as PublicKey).toBase58(),
          isActive: decoded.isActive ?? true,
          apiKey: DEFAULT_API_KEY,
        };

        await agentStorage.create(config, operator);
        console.log(`[factory-ws] New agent detected: ${agentId} (${name}) by ${operator}`);
      } catch (err) {
        console.error('[factory-ws] Failed to decode account:', err instanceof Error ? err.message : err);
      }
    },
    'confirmed',
    [{ memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(AGENT_METADATA_DISCRIMINATOR) } }],
  );

    console.log('[factory-ws] Subscription active, id:', subscriptionId);
  } catch (err) {
    console.warn('[factory-ws] WebSocket subscription failed, will rely on polling:', err instanceof Error ? err.message : err);
  }
}

export function unsubscribeFromFactory(): void {
  if (subscriptionId !== null) {
    const connection = new Connection(RPC_URL, 'confirmed');
    connection.removeProgramAccountChangeListener(subscriptionId);
    console.log('[factory-ws] Unsubscribed');
    subscriptionId = null;
  }
}
