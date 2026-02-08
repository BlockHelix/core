import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { agentStorage } from './storage';
import { RPC_URL } from '../config';

export interface VaultStats {
  tvl: number;
  revenue: number;
  jobs: number;
  updatedAt: number;
}

const cache = new Map<string, VaultStats>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function loadIdl(path: string): anchor.Idl {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function refreshVaultStats(): Promise<void> {
  let vaultIdl: anchor.Idl;
  try {
    vaultIdl = loadIdl(
      process.env.VAULT_IDL_PATH || `${process.cwd()}/target/idl/agent_vault.json`
    );
  } catch {
    console.warn('[vault-cache] Could not load vault IDL, skipping refresh');
    return;
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: 'confirmed' }
  );
  const vaultProgram = new anchor.Program(vaultIdl, provider);

  const agents = agentStorage.getAll();
  console.log(`[vault-cache] Refreshing vault stats for ${agents.length} agents`);

  for (const agent of agents) {
    if (!agent.vault) continue;
    try {
      const vaultPubkey = new PublicKey(agent.vault);
      const vaultData = await (vaultProgram.account as any).vaultState.fetch(vaultPubkey);
      const v = vaultData as any;

      let tvl = 0;
      try {
        const balance = await connection.getTokenAccountBalance(v.vaultUsdcAccount as PublicKey);
        tvl = parseFloat(balance.value.amount) / 1_000_000;
      } catch { /* token account may not exist */ }

      const revenue = (v.totalRevenue as anchor.BN).toNumber() / 1_000_000;
      const jobs = (v.totalJobs as anchor.BN).toNumber();

      cache.set(agent.agentId, { tvl, revenue, jobs, updatedAt: Date.now() });
    } catch { /* vault may not be initialized */ }

    await sleep(200);
  }

  console.log(`[vault-cache] Refresh complete, ${cache.size} vaults cached`);
}

export function startVaultRefresh(intervalMs = 300_000): void {
  refreshVaultStats().catch(err =>
    console.error('[vault-cache] Initial refresh failed:', err)
  );
  refreshTimer = setInterval(() => {
    refreshVaultStats().catch(err =>
      console.error('[vault-cache] Refresh failed:', err)
    );
  }, intervalMs);
}

export function stopVaultRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function getVaultStats(agentId: string): VaultStats | undefined {
  return cache.get(agentId);
}

export function getAllVaultStats(): Map<string, VaultStats> {
  return cache;
}
