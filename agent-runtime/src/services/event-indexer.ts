import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Logs } from '@solana/web3.js';
import { Pool } from 'pg';
import fs from 'fs';
import { agentStorage } from './storage';
import { RPC_URL, VAULT_PROGRAM_ID, REGISTRY_PROGRAM_ID } from '../config';

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

const DATABASE_URL = process.env.DATABASE_URL || '';
const CURSOR_FLUSH_INTERVAL = 5000;
const TVL_DEBOUNCE = 30_000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function loadIdl(path: string): anchor.Idl {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

function toBigInt(value: any): bigint {
  if (value == null) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') return BigInt(value);
  if (typeof value.toString === 'function') return BigInt(value.toString());
  return 0n;
}

function microToNumber(value: any): number {
  if (value == null) return 0;
  const n = typeof value === 'string' ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 1_000_000;
}

function toNumber(value: any): number {
  if (value == null) return 0;
  const n = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dateKey(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().slice(0, 10);
}

class EventIndexer {
  private connection: Connection;
  private pool: Pool | null = null;
  private vaultProgram: anchor.Program | null = null;
  private vaultToAgentId = new Map<string, string>();
  private agentIdToVault = new Map<string, string>();
  private registryToVault = new Map<string, string>();
  private lastSignatures = { vault: null as string | null, registry: null as string | null };
  private cursorDirty = new Set<'vault' | 'registry'>();
  private cursorFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private tvlDebounce = new Map<string, number>();
  private subscriptionIds: number[] = [];
  private initDone = false;
  private eventsIndexed = 0;
  private lastBackfill = 0;

  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS indexer_cursors (
        program TEXT PRIMARY KEY,
        last_signature TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS agent_stats (
        vault TEXT PRIMARY KEY,
        total_revenue BIGINT NOT NULL DEFAULT 0,
        total_jobs BIGINT NOT NULL DEFAULT 0,
        operator_bond BIGINT NOT NULL DEFAULT 0,
        total_slashed BIGINT NOT NULL DEFAULT 0,
        slash_events INTEGER NOT NULL DEFAULT 0,
        paused BOOLEAN NOT NULL DEFAULT false,
        jobs_recorded BIGINT NOT NULL DEFAULT 0,
        api_calls BIGINT NOT NULL DEFAULT 0,
        tvl BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS revenue_daily (
        vault TEXT NOT NULL,
        day DATE NOT NULL,
        revenue BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (vault, day)
      );

      CREATE TABLE IF NOT EXISTS job_receipts (
        vault TEXT NOT NULL,
        job_id BIGINT NOT NULL,
        client TEXT NOT NULL,
        payment_amount BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        status TEXT NOT NULL,
        tx_signature TEXT NOT NULL,
        PRIMARY KEY (vault, job_id)
      );

      CREATE INDEX IF NOT EXISTS idx_job_receipts_vault_created ON job_receipts(vault, created_at DESC);
    `);
  }

  private getRegistryPda(vault: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), vault.toBuffer()],
      REGISTRY_PROGRAM_ID
    );
    return pda;
  }

  private async loadCursors(): Promise<void> {
    if (!this.pool) return;
    const rows = await this.pool.query('SELECT program, last_signature FROM indexer_cursors');
    for (const row of rows.rows) {
      if (row.program === 'vault') this.lastSignatures.vault = row.last_signature;
      if (row.program === 'registry') this.lastSignatures.registry = row.last_signature;
    }
  }

  private scheduleCursorFlush(): void {
    if (this.cursorFlushTimer) return;
    this.cursorFlushTimer = setTimeout(() => {
      this.flushCursors().catch(err => console.warn('[indexer] Failed to flush cursors:', err.message));
    }, CURSOR_FLUSH_INTERVAL);
  }

  private async flushCursors(): Promise<void> {
    if (!this.pool) return;
    for (const program of this.cursorDirty) {
      const last = this.lastSignatures[program];
      if (!last) continue;
      await this.pool.query(
        `INSERT INTO indexer_cursors (program, last_signature, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (program) DO UPDATE SET last_signature = EXCLUDED.last_signature, updated_at = now()`
        , [program, last]
      );
    }
    this.cursorDirty.clear();
    if (this.cursorFlushTimer) {
      clearTimeout(this.cursorFlushTimer);
      this.cursorFlushTimer = null;
    }
  }

  private setCursor(program: 'vault' | 'registry', signature: string): void {
    this.lastSignatures[program] = signature;
    this.cursorDirty.add(program);
    this.scheduleCursorFlush();
  }

  private buildMappings(): void {
    this.vaultToAgentId.clear();
    this.agentIdToVault.clear();
    this.registryToVault.clear();

    const agents = agentStorage.getAll();
    for (const agent of agents) {
      if (!agent.vault) continue;
      this.vaultToAgentId.set(agent.vault, agent.agentId);
      this.agentIdToVault.set(agent.agentId, agent.vault);

      let registry = agent.registry;
      if (!registry) {
        try {
          registry = this.getRegistryPda(new PublicKey(agent.vault)).toBase58();
        } catch { /* ignore */ }
      }
      if (registry) this.registryToVault.set(registry, agent.vault);
    }
    console.log(`[indexer] Built mappings for ${this.vaultToAgentId.size} vaults`);
  }

  private async ensureStatsRows(vaults: string[]): Promise<void> {
    if (!this.pool || vaults.length === 0) return;
    await this.pool.query(
      `INSERT INTO agent_stats (vault)
       SELECT UNNEST($1::text[])
       ON CONFLICT (vault) DO NOTHING`,
      [vaults]
    );
  }

  refreshMappings(): void {
    this.buildMappings();
    void this.ensureStatsRows(Array.from(this.vaultToAgentId.keys()));
  }

  async init(): Promise<void> {
    console.log('[indexer] Starting event indexer...');

    if (!DATABASE_URL) {
      console.warn('[indexer] DATABASE_URL not set; indexer disabled');
      this.initDone = true;
      return;
    }

    try {
      this.pool = new Pool({ connectionString: DATABASE_URL });
      await this.pool.query('SELECT 1');
    } catch (err) {
      console.warn('[indexer] Failed to connect to Postgres:', err instanceof Error ? err.message : err);
      this.initDone = true;
      return;
    }
    await this.ensureSchema();
    await this.loadCursors();

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

    this.buildMappings();
    await this.ensureStatsRows(Array.from(this.vaultToAgentId.keys()));

    await this.backfill(VAULT_PROGRAM_ID, vaultParser, 'vault');
    await this.backfill(REGISTRY_PROGRAM_ID, registryParser, 'registry');

    await this.refreshAllTvl();

    this.subscribeLive(VAULT_PROGRAM_ID, vaultParser, 'vault');
    this.subscribeLive(REGISTRY_PROGRAM_ID, registryParser, 'registry');

    this.initDone = true;
    this.lastBackfill = Date.now();
    console.log(`[indexer] Init complete. ${this.vaultToAgentId.size} vaults tracked, ${this.eventsIndexed} events indexed`);
  }

  private async backfill(programId: PublicKey, parser: anchor.EventParser, label: 'vault' | 'registry'): Promise<void> {
    const lastSig = this.lastSignatures[label];
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

    let lastProcessed: string | null = null;

    for (const { signature } of allSigs) {
      try {
        const tx = await this.connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        if (!tx?.meta?.logMessages) {
          lastProcessed = signature;
          continue;
        }

        for (const event of parser.parseLogs(tx.meta.logMessages)) {
          await this.processEvent(event.name, event.data, signature);
        }

        lastProcessed = signature;
      } catch (e) {
        console.warn(`[indexer] Failed to parse tx ${signature.slice(0, 8)}:`, (e as Error).message);
      }
      await sleep(100);
    }

    if (lastProcessed) {
      this.setCursor(label, lastProcessed);
      await this.flushCursors();
    }

    console.log(`[indexer] ${label} backfill complete`);
  }

  private async processEvent(name: string, data: any, txSignature: string): Promise<void> {
    this.eventsIndexed++;
    const vault = data.vault?.toString();
    if (!vault && !data.registry) return;

    let vaultKey = vault;
    if (!vaultKey && data.registry) {
      vaultKey = this.registryToVault.get(data.registry.toString());
    }
    if (!vaultKey || !this.pool) return;

    await this.ensureStatsRows([vaultKey]);

    switch (name) {
      case 'Deposited':
      case 'Withdrawn':
        this.debounceTvlRefresh(vaultKey);
        break;

      case 'RevenueReceived': {
        const vaultCut = toBigInt(data.vaultCut || data.vault_cut);
        await this.pool.query(
          `INSERT INTO agent_stats (vault, total_revenue, total_jobs, updated_at)
           VALUES ($1, $2, 1, now())
           ON CONFLICT (vault) DO UPDATE
           SET total_revenue = agent_stats.total_revenue + $2,
               total_jobs = agent_stats.total_jobs + 1,
               updated_at = now()`,
          [vaultKey, vaultCut.toString()]
        );

        const day = dateKey();
        await this.pool.query(
          `INSERT INTO revenue_daily (vault, day, revenue)
           VALUES ($1, $2, $3)
           ON CONFLICT (vault, day) DO UPDATE
           SET revenue = revenue_daily.revenue + $3`,
          [vaultKey, day, vaultCut.toString()]
        );

        this.debounceTvlRefresh(vaultKey);
        break;
      }

      case 'Slashed': {
        const slashTotal = toBigInt(data.slashTotal || data.slash_total);
        await this.pool.query(
          `INSERT INTO agent_stats (vault, total_slashed, slash_events, updated_at)
           VALUES ($1, $2, 1, now())
           ON CONFLICT (vault) DO UPDATE
           SET total_slashed = agent_stats.total_slashed + $2,
               slash_events = agent_stats.slash_events + 1,
               updated_at = now()`,
          [vaultKey, slashTotal.toString()]
        );
        break;
      }

      case 'VaultPaused':
        await this.pool.query(
          `INSERT INTO agent_stats (vault, paused, updated_at)
           VALUES ($1, true, now())
           ON CONFLICT (vault) DO UPDATE SET paused = true, updated_at = now()`,
          [vaultKey]
        );
        break;

      case 'VaultUnpaused':
        await this.pool.query(
          `INSERT INTO agent_stats (vault, paused, updated_at)
           VALUES ($1, false, now())
           ON CONFLICT (vault) DO UPDATE SET paused = false, updated_at = now()`,
          [vaultKey]
        );
        break;

      case 'JobRecorded': {
        const jobId = toBigInt(data.jobId || data.job_id);
        const client = data.client?.toString() || '';
        const paymentAmount = toBigInt(data.paymentAmount || data.payment_amount);
        const createdAt = toBigInt(data.createdAt || data.created_at);

        await this.pool.query(
          `INSERT INTO job_receipts (vault, job_id, client, payment_amount, created_at, status, tx_signature)
           VALUES ($1, $2, $3, $4, $5, 'active', $6)
           ON CONFLICT (vault, job_id) DO UPDATE
           SET client = EXCLUDED.client,
               payment_amount = EXCLUDED.payment_amount,
               created_at = EXCLUDED.created_at,
               status = EXCLUDED.status,
               tx_signature = EXCLUDED.tx_signature`,
          [vaultKey, jobId.toString(), client, paymentAmount.toString(), createdAt.toString(), txSignature]
        );

        await this.pool.query(
          `INSERT INTO agent_stats (vault, jobs_recorded, updated_at)
           VALUES ($1, 1, now())
           ON CONFLICT (vault) DO UPDATE
           SET jobs_recorded = agent_stats.jobs_recorded + 1,
               updated_at = now()`,
          [vaultKey]
        );
        break;
      }

      case 'JobChallenged': {
        const jobId = toBigInt(data.jobId || data.job_id);
        await this.pool.query(
          `UPDATE job_receipts SET status = 'challenged' WHERE vault = $1 AND job_id = $2`,
          [vaultKey, jobId.toString()]
        );
        break;
      }

      case 'JobResolved': {
        const jobId = toBigInt(data.jobId || data.job_id);
        await this.pool.query(
          `UPDATE job_receipts SET status = 'resolved' WHERE vault = $1 AND job_id = $2`,
          [vaultKey, jobId.toString()]
        );
        break;
      }

      case 'JobFinalized': {
        const jobId = toBigInt(data.jobId || data.job_id);
        await this.pool.query(
          `UPDATE job_receipts SET status = 'finalized' WHERE vault = $1 AND job_id = $2`,
          [vaultKey, jobId.toString()]
        );
        break;
      }
    }
  }

  private debounceTvlRefresh(vault: string): void {
    const last = this.tvlDebounce.get(vault) || 0;
    if (Date.now() - last < TVL_DEBOUNCE) return;
    this.tvlDebounce.set(vault, Date.now());
    this.refreshTvl(vault).catch(e => console.warn(`[indexer] TVL refresh failed for ${vault.slice(0, 8)}:`, e.message));
  }

  private async refreshTvl(vault: string): Promise<void> {
    if (!this.vaultProgram || !this.pool) return;
    try {
      const vaultPubkey = new PublicKey(vault);
      const vaultData = await (this.vaultProgram.account as any).vaultState.fetch(vaultPubkey);
      const v = vaultData as any;

      let tvl = 0n;
      try {
        const balance = await this.connection.getTokenAccountBalance(v.vaultUsdcAccount as PublicKey);
        tvl = BigInt(balance.value.amount);
      } catch { /* token account may not exist */ }

      const operatorBond = toBigInt(v.operatorBond);
      const paused = !!v.paused;

      await this.pool.query(
        `INSERT INTO agent_stats (vault, tvl, operator_bond, paused, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (vault) DO UPDATE
         SET tvl = $2, operator_bond = $3, paused = $4, updated_at = now()`,
        [vault, tvl.toString(), operatorBond.toString(), paused]
      );
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

  private subscribeLive(programId: PublicKey, parser: anchor.EventParser, label: 'vault' | 'registry'): void {
    try {
      const id = this.connection.onLogs(programId, (logs: Logs) => {
        if (logs.err) return;
        try {
          for (const event of parser.parseLogs(logs.logs)) {
            void this.processEvent(event.name, event.data, logs.signature);
          }
          this.setCursor(label, logs.signature);
        } catch { /* parse errors are non-fatal */ }
      }, 'confirmed');
      this.subscriptionIds.push(id);
      console.log(`[indexer] Subscribed to ${programId.toBase58().slice(0, 8)}... (sub ${id})`);
    } catch (e) {
      console.warn(`[indexer] WebSocket subscribe failed for ${programId.toBase58().slice(0, 8)}:`, (e as Error).message);
    }
  }

  private rowToStats(row: any, withDetails: boolean): AgentStats {
    return {
      tvl: microToNumber(row.tvl),
      totalRevenue: microToNumber(row.total_revenue),
      totalJobs: toNumber(row.total_jobs),
      operatorBond: microToNumber(row.operator_bond),
      totalSlashed: microToNumber(row.total_slashed),
      slashEvents: toNumber(row.slash_events),
      paused: !!row.paused,
      jobsRecorded: toNumber(row.jobs_recorded),
      apiCalls: toNumber(row.api_calls),
      revenueByDay: withDetails ? [] : [],
      recentJobs: withDetails ? [] : [],
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  async getStats(vault: string, withDetails = false): Promise<AgentStats | undefined> {
    if (!this.pool) return undefined;
    const res = await this.pool.query('SELECT * FROM agent_stats WHERE vault = $1', [vault]);
    if (res.rows.length === 0) return undefined;

    const base = this.rowToStats(res.rows[0], withDetails);

    if (withDetails) {
      const revenueRows = await this.pool.query(
        'SELECT day, revenue FROM revenue_daily WHERE vault = $1 ORDER BY day ASC',
        [vault]
      );
      base.revenueByDay = revenueRows.rows.map((r: any) => ({
        date: typeof r.day === 'string' ? r.day : r.day.toISOString().slice(0, 10),
        revenue: microToNumber(r.revenue),
      }));

      const jobRows = await this.pool.query(
        'SELECT job_id, client, payment_amount, created_at, status, tx_signature FROM job_receipts WHERE vault = $1 ORDER BY created_at DESC LIMIT 50',
        [vault]
      );
      base.recentJobs = jobRows.rows.map((r: any) => ({
        jobId: toNumber(r.job_id),
        client: r.client,
        paymentAmount: toNumber(r.payment_amount),
        createdAt: toNumber(r.created_at),
        status: r.status,
        txSignature: r.tx_signature,
      }));
    }

    return base;
  }

  async getStatsForVaults(vaults: string[]): Promise<Map<string, AgentStats>> {
    const map = new Map<string, AgentStats>();
    if (!this.pool || vaults.length === 0) return map;

    const res = await this.pool.query('SELECT * FROM agent_stats WHERE vault = ANY($1)', [vaults]);
    for (const row of res.rows) {
      map.set(row.vault, this.rowToStats(row, false));
    }
    return map;
  }

  async getStatsByAgentId(agentId: string, withDetails = false): Promise<AgentStats | undefined> {
    let vault = this.agentIdToVault.get(agentId);
    if (!vault) {
      const agent = agentStorage.get(agentId);
      if (agent?.vault) {
        vault = agent.vault;
        this.agentIdToVault.set(agentId, vault);
        this.vaultToAgentId.set(vault, agentId);
      }
    }
    if (!vault) return undefined;
    return this.getStats(vault, withDetails);
  }

  incrementApiCalls(agentId: string): void {
    let vault = this.agentIdToVault.get(agentId);
    if (!vault) {
      const agent = agentStorage.get(agentId);
      if (agent?.vault) {
        vault = agent.vault;
        this.agentIdToVault.set(agentId, vault);
        this.vaultToAgentId.set(vault, agentId);
      }
    }
    if (!vault || !this.pool) return;
    void this.pool.query(
      `INSERT INTO agent_stats (vault, api_calls, updated_at)
       VALUES ($1, 1, now())
       ON CONFLICT (vault) DO UPDATE
       SET api_calls = agent_stats.api_calls + 1,
           updated_at = now()`,
      [vault]
    ).catch(err => console.warn('[indexer] Failed to increment api calls:', err.message));
  }

  getStatus() {
    return {
      initialized: this.initDone,
      vaultsTracked: this.vaultToAgentId.size,
      eventsIndexed: this.eventsIndexed,
      lastBackfill: this.lastBackfill ? new Date(this.lastBackfill).toISOString() : null,
      subscriptions: this.subscriptionIds.length,
      database: DATABASE_URL ? 'postgres' : 'disabled',
    };
  }

  async shutdown(): Promise<void> {
    for (const id of this.subscriptionIds) {
      try { await this.connection.removeOnLogsListener(id); } catch {}
    }
    await this.flushCursors();
    if (this.pool) await this.pool.end();
  }
}

export const eventIndexer = new EventIndexer();
