import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Logs } from '@solana/web3.js';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { agentStorage } from './storage';
import { RPC_URL, VAULT_PROGRAM_ID, REGISTRY_PROGRAM_ID, FACTORY_PROGRAM_ID } from '../config';

export interface AgentStats {
  tvl: number;
  totalRevenue: number;
  totalJobs: number;
  operatorBond: number;
  totalSlashed: number;
  slashEvents: number;
  paused: boolean;
  jobsRecorded: number;
  apiCalls: number;
  revenueByDay: { date: string; revenue: number }[];
  recentJobs: { jobId: number; client: string; paymentAmount: number; createdAt: number; status: string; txSignature: string }[];
  updatedAt: number;
}

interface IndexerSnapshot {
  version: 1;
  lastSignatures: { vault: string | null; registry: string | null; factory: string | null };
  agentStats: Record<string, AgentStats>;
  apiCalls: Record<string, number>;
  savedAt: number;
}

const S3_BUCKET = process.env.STORAGE_BUCKET || 'blockhelix-dev-storage';
const S3_KEY = 'indexer-snapshot.json';
const USE_S3 = process.env.USE_S3_STORAGE === 'true';
const SNAPSHOT_INTERVAL = 60_000;
const TVL_DEBOUNCE = 30_000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function loadIdl(path: string): anchor.Idl {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

function dateKey(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().slice(0, 10);
}

class EventIndexer {
  private connection: Connection;
  private s3: S3Client;
  private stats = new Map<string, AgentStats>();
  private apiCalls = new Map<string, number>();
  private vaultToAgentId = new Map<string, string>();
  private registryToVault = new Map<string, string>();
  private lastSignatures = { vault: null as string | null, registry: null as string | null, factory: null as string | null };
  private dirty = false;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private tvlDebounce = new Map<string, number>();
  private subscriptionIds: number[] = [];
  private vaultProgram: anchor.Program | null = null;
  private initDone = false;
  private eventsIndexed = 0;
  private lastBackfill = 0;

  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  async init(): Promise<void> {
    console.log('[indexer] Starting event indexer...');

    const provider = new anchor.AnchorProvider(
      this.connection,
      { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
      { commitment: 'confirmed' }
    );

    let vaultIdl: anchor.Idl, registryIdl: anchor.Idl;
    try {
      vaultIdl = loadIdl(process.env.VAULT_IDL_PATH || `${process.cwd()}/target/idl/agent_vault.json`);
      registryIdl = loadIdl(process.env.REGISTRY_IDL_PATH || `${process.cwd()}/target/idl/receipt_registry.json`);
    } catch (e) {
      console.warn('[indexer] Could not load IDLs, running in degraded mode');
      this.initDone = true;
      return;
    }

    this.vaultProgram = new anchor.Program(vaultIdl, provider);
    const registryProgram = new anchor.Program(registryIdl, provider);

    const vaultParser = new anchor.EventParser(VAULT_PROGRAM_ID, new anchor.BorshCoder(vaultIdl));
    const registryParser = new anchor.EventParser(REGISTRY_PROGRAM_ID, new anchor.BorshCoder(registryIdl));

    await this.loadSnapshot();
    this.buildMappings();

    await this.backfill(VAULT_PROGRAM_ID, vaultParser, 'vault');
    await this.backfill(REGISTRY_PROGRAM_ID, registryParser, 'registry');

    await this.refreshAllTvl();

    this.subscribeLive(VAULT_PROGRAM_ID, vaultParser);
    this.subscribeLive(REGISTRY_PROGRAM_ID, registryParser);

    this.snapshotTimer = setInterval(() => this.saveSnapshot(), SNAPSHOT_INTERVAL);
    this.initDone = true;
    this.lastBackfill = Date.now();
    console.log(`[indexer] Init complete. ${this.stats.size} vaults tracked, ${this.eventsIndexed} events indexed`);
  }

  private buildMappings(): void {
    const agents = agentStorage.getAll();
    for (const agent of agents) {
      if (agent.vault) {
        this.vaultToAgentId.set(agent.vault, agent.agentId);
        if (agent.registry) {
          this.registryToVault.set(agent.registry, agent.vault);
        }
      }
    }
    console.log(`[indexer] Built mappings for ${this.vaultToAgentId.size} vaults`);
  }

  refreshMappings(): void {
    this.buildMappings();
  }

  private defaultStats(): AgentStats {
    return {
      tvl: 0, totalRevenue: 0, totalJobs: 0, operatorBond: 0,
      totalSlashed: 0, slashEvents: 0, paused: false, jobsRecorded: 0,
      apiCalls: 0, revenueByDay: [], recentJobs: [], updatedAt: Date.now(),
    };
  }

  private getOrCreate(vault: string): AgentStats {
    let s = this.stats.get(vault);
    if (!s) {
      s = this.defaultStats();
      const agentId = this.vaultToAgentId.get(vault);
      if (agentId) {
        s.apiCalls = this.apiCalls.get(agentId) || 0;
      }
      this.stats.set(vault, s);
    }
    return s;
  }

  private async backfill(programId: PublicKey, parser: anchor.EventParser, label: string): Promise<void> {
    const lastSig = this.lastSignatures[label as keyof typeof this.lastSignatures];
    console.log(`[indexer] Backfilling ${label} from ${lastSig ? lastSig.slice(0, 8) + '...' : 'beginning'}`);

    let allSigs: { signature: string }[] = [];
    let before: string | undefined;
    let page = 0;

    while (true) {
      const opts: any = { limit: 1000 };
      if (before) opts.before = before;
      if (lastSig && page === 0) opts.until = lastSig;

      let sigs: any[];
      try {
        sigs = await this.connection.getSignaturesForAddress(programId, opts, 'confirmed');
      } catch (e) {
        console.warn(`[indexer] getSignatures failed for ${label}:`, (e as Error).message);
        break;
      }

      if (sigs.length === 0) break;
      allSigs.push(...sigs);
      before = sigs[sigs.length - 1].signature;
      page++;

      if (sigs.length < 1000) break;
      await sleep(200);
    }

    allSigs.reverse();
    console.log(`[indexer] ${label}: ${allSigs.length} transactions to process`);

    for (const { signature } of allSigs) {
      try {
        const tx = await this.connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        if (!tx?.meta?.logMessages) continue;

        for (const event of parser.parseLogs(tx.meta.logMessages)) {
          this.processEvent(event.name, event.data, signature);
        }
      } catch (e) {
        console.warn(`[indexer] Failed to parse tx ${signature.slice(0, 8)}:`, (e as Error).message);
      }
      await sleep(100);
    }

    if (allSigs.length > 0) {
      (this.lastSignatures as any)[label] = allSigs[allSigs.length - 1].signature;
      this.dirty = true;
    }

    console.log(`[indexer] ${label} backfill complete`);
  }

  private processEvent(name: string, data: any, txSignature: string): void {
    this.eventsIndexed++;
    const vault = data.vault?.toString();
    if (!vault && !data.registry) return;

    let vaultKey = vault;
    if (!vaultKey && data.registry) {
      vaultKey = this.registryToVault.get(data.registry.toString());
    }
    if (!vaultKey) return;

    const s = this.getOrCreate(vaultKey);

    switch (name) {
      case 'Deposited':
      case 'Withdrawn':
        this.debounceTvlRefresh(vaultKey);
        break;

      case 'RevenueReceived': {
        const vaultCut = toNum(data.vaultCut || data.vault_cut) / 1_000_000;
        s.totalRevenue += vaultCut;
        s.totalJobs++;
        const day = dateKey();
        const existing = s.revenueByDay.find(r => r.date === day);
        if (existing) existing.revenue += vaultCut;
        else s.revenueByDay.push({ date: day, revenue: vaultCut });
        if (s.revenueByDay.length > 90) s.revenueByDay = s.revenueByDay.slice(-90);
        this.debounceTvlRefresh(vaultKey);
        break;
      }

      case 'Slashed': {
        const slashTotal = toNum(data.slashTotal || data.slash_total) / 1_000_000;
        s.totalSlashed += slashTotal;
        s.slashEvents++;
        break;
      }

      case 'VaultPaused':
        s.paused = true;
        break;

      case 'VaultUnpaused':
        s.paused = false;
        break;

      case 'JobRecorded': {
        s.jobsRecorded++;
        const job = {
          jobId: toNum(data.jobId || data.job_id),
          client: data.client?.toString() || '',
          paymentAmount: toNum(data.paymentAmount || data.payment_amount),
          createdAt: toNum(data.createdAt || data.created_at),
          status: 'active',
          txSignature,
        };
        s.recentJobs.unshift(job);
        if (s.recentJobs.length > 50) s.recentJobs = s.recentJobs.slice(0, 50);
        break;
      }

      case 'JobChallenged': {
        const jobId = toNum(data.jobId || data.job_id);
        const job = s.recentJobs.find(j => j.jobId === jobId);
        if (job) job.status = 'challenged';
        break;
      }

      case 'JobResolved': {
        const jobId = toNum(data.jobId || data.job_id);
        const job = s.recentJobs.find(j => j.jobId === jobId);
        if (job) job.status = 'resolved';
        break;
      }

      case 'JobFinalized': {
        const jobId = toNum(data.jobId || data.job_id);
        const job = s.recentJobs.find(j => j.jobId === jobId);
        if (job) job.status = 'finalized';
        break;
      }
    }

    s.updatedAt = Date.now();
    this.dirty = true;
  }

  private debounceTvlRefresh(vault: string): void {
    const last = this.tvlDebounce.get(vault) || 0;
    if (Date.now() - last < TVL_DEBOUNCE) return;
    this.tvlDebounce.set(vault, Date.now());
    this.refreshTvl(vault).catch(e => console.warn(`[indexer] TVL refresh failed for ${vault.slice(0, 8)}:`, e.message));
  }

  private async refreshTvl(vault: string): Promise<void> {
    if (!this.vaultProgram) return;
    try {
      const vaultPubkey = new PublicKey(vault);
      const vaultData = await (this.vaultProgram.account as any).vaultState.fetch(vaultPubkey);
      const v = vaultData as any;
      const s = this.getOrCreate(vault);

      try {
        const balance = await this.connection.getTokenAccountBalance(v.vaultUsdcAccount as PublicKey);
        s.tvl = parseFloat(balance.value.amount) / 1_000_000;
      } catch { /* token account may not exist */ }

      s.operatorBond = toNum(v.operatorBond) / 1_000_000;
      s.paused = v.paused;
      s.updatedAt = Date.now();
      this.dirty = true;
    } catch { /* vault may not be initialized */ }
  }

  private async refreshAllTvl(): Promise<void> {
    const agents = agentStorage.getAll();
    console.log(`[indexer] Reading TVL for ${agents.length} vaults`);
    for (const agent of agents) {
      if (!agent.vault) continue;
      await this.refreshTvl(agent.vault);
      await sleep(200);
    }
  }

  private subscribeLive(programId: PublicKey, parser: anchor.EventParser): void {
    try {
      const id = this.connection.onLogs(programId, (logs: Logs) => {
        if (logs.err) return;
        try {
          for (const event of parser.parseLogs(logs.logs)) {
            this.processEvent(event.name, event.data, logs.signature);
          }
        } catch { /* parse errors are non-fatal */ }
      }, 'confirmed');
      this.subscriptionIds.push(id);
      console.log(`[indexer] Subscribed to ${programId.toBase58().slice(0, 8)}... (sub ${id})`);
    } catch (e) {
      console.warn(`[indexer] WebSocket subscribe failed for ${programId.toBase58().slice(0, 8)}:`, (e as Error).message);
    }
  }

  private async loadSnapshot(): Promise<void> {
    if (!USE_S3) return;
    try {
      const response = await this.s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY }));
      const body = await response.Body?.transformToString();
      if (!body) return;
      const snapshot: IndexerSnapshot = JSON.parse(body);
      if (snapshot.version !== 1) return;

      this.lastSignatures = snapshot.lastSignatures;
      for (const [vault, s] of Object.entries(snapshot.agentStats)) {
        this.stats.set(vault, s);
      }
      for (const [agentId, count] of Object.entries(snapshot.apiCalls)) {
        this.apiCalls.set(agentId, count);
      }
      console.log(`[indexer] Loaded snapshot from S3 (${Object.keys(snapshot.agentStats).length} vaults, saved ${new Date(snapshot.savedAt).toISOString()})`);
    } catch (e: any) {
      if (e.name !== 'NoSuchKey') console.warn('[indexer] Failed to load snapshot:', e.message);
    }
  }

  private async saveSnapshot(): Promise<void> {
    if (!this.dirty || !USE_S3) return;

    const snapshot: IndexerSnapshot = {
      version: 1,
      lastSignatures: this.lastSignatures,
      agentStats: Object.fromEntries(this.stats),
      apiCalls: Object.fromEntries(this.apiCalls),
      savedAt: Date.now(),
    };

    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: S3_KEY,
        Body: JSON.stringify(snapshot),
        ContentType: 'application/json',
      }));
      this.dirty = false;
      console.log(`[indexer] Snapshot saved (${this.stats.size} vaults)`);
    } catch (e) {
      console.warn('[indexer] Failed to save snapshot:', (e as Error).message);
    }
  }

  getStats(vault: string): AgentStats | undefined {
    const s = this.stats.get(vault);
    if (!s) return undefined;
    const agentId = this.vaultToAgentId.get(vault);
    if (agentId) s.apiCalls = this.apiCalls.get(agentId) || 0;
    return s;
  }

  getStatsByAgentId(agentId: string): AgentStats | undefined {
    for (const [vault, aid] of this.vaultToAgentId) {
      if (aid === agentId) return this.getStats(vault);
    }
    return undefined;
  }

  getAllStats(): Map<string, AgentStats> {
    return this.stats;
  }

  incrementApiCalls(agentId: string): void {
    this.apiCalls.set(agentId, (this.apiCalls.get(agentId) || 0) + 1);
    this.dirty = true;
  }

  getAgentIdForVault(vault: string): string | undefined {
    return this.vaultToAgentId.get(vault);
  }

  getStatus() {
    return {
      initialized: this.initDone,
      vaultsTracked: this.stats.size,
      eventsIndexed: this.eventsIndexed,
      lastBackfill: this.lastBackfill ? new Date(this.lastBackfill).toISOString() : null,
      subscriptions: this.subscriptionIds.length,
    };
  }

  async shutdown(): Promise<void> {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    for (const id of this.subscriptionIds) {
      try { await this.connection.removeOnLogsListener(id); } catch {}
    }
    await this.saveSnapshot();
  }
}

export const eventIndexer = new EventIndexer();
