import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { agentStorage } from './storage';
import { RPC_URL, REGISTRY_PROGRAM_ID } from '../config';

export interface VaultStats {
  tvl: number;
  revenue: number;
  jobs: number;
  calls: number;
  updatedAt: number;
}

const cache = new Map<string, VaultStats>();
const callCounts = new Map<string, number>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function loadIdl(path: string): anchor.Idl {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function incrementCallCount(agentId: string): void {
  callCounts.set(agentId, (callCounts.get(agentId) || 0) + 1);
}

function getRegistryPda(vault: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), vault.toBuffer()],
    REGISTRY_PROGRAM_ID
  );
  return pda;
}

export async function refreshVaultStats(): Promise<void> {
  let vaultIdl: anchor.Idl;
  let registryIdl: anchor.Idl;
  try {
    vaultIdl = loadIdl(
      process.env.VAULT_IDL_PATH || `${process.cwd()}/target/idl/agent_vault.json`
    );
  } catch {
    console.warn('[vault-cache] Could not load vault IDL, skipping refresh');
    return;
  }
  try {
    registryIdl = loadIdl(
      process.env.REGISTRY_IDL_PATH || `${process.cwd()}/target/idl/receipt_registry.json`
    );
  } catch {
    registryIdl = null as any;
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: 'confirmed' }
  );
  const vaultProgram = new anchor.Program(vaultIdl, provider);
  const registryProgram = registryIdl ? new anchor.Program(registryIdl, provider) : null;

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
      let jobs = (v.totalJobs as anchor.BN).toNumber();

      if (registryProgram) {
        try {
          const registryPda = getRegistryPda(vaultPubkey);
          const registryData = await (registryProgram.account as any).registryState.fetch(registryPda);
          const registryJobs = (registryData.jobCounter as anchor.BN).toNumber();
          jobs = Math.max(jobs, registryJobs);
        } catch { /* registry may not exist */ }
      }

      const calls = callCounts.get(agent.agentId) || 0;
      cache.set(agent.agentId, { tvl, revenue, jobs, calls, updatedAt: Date.now() });
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
