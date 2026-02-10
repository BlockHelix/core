import crypto from 'crypto';
import { Keypair } from '@solana/web3.js';
import type { AgentConfig } from '../types';
import { encrypt, decrypt, isEncrypted } from './crypto';
import { pool } from './db';

export interface StoredAgent extends AgentConfig {
  ownerWallet: string;
  sdkKey?: string;
  createdAt: number;
  updatedAt: number;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  vault TEXT PRIMARY KEY,
  agent_id TEXT,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  price_usdc_micro BIGINT NOT NULL DEFAULT 100000,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  operator TEXT NOT NULL,
  registry TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_key_encrypted TEXT,
  agent_wallet TEXT,
  wallet_secret_key_encrypted TEXT,
  owner_wallet TEXT NOT NULL,
  is_containerized BOOLEAN DEFAULT false,
  container_ip TEXT,
  sdk_key TEXT,
  deploy_status TEXT DEFAULT 'pending',
  deploy_phase TEXT,
  deploy_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
`;

function rowToStored(row: any): StoredAgent {
  return {
    agentId: row.agent_id || '',
    name: row.name,
    systemPrompt: row.system_prompt,
    priceUsdcMicro: Number(row.price_usdc_micro),
    model: row.model,
    operator: row.operator,
    vault: row.vault,
    registry: row.registry || '',
    isActive: row.is_active,
    apiKey: row.api_key_encrypted || '',
    agentWallet: row.agent_wallet || undefined,
    walletSecretKey: row.wallet_secret_key_encrypted || undefined,
    ownerWallet: row.owner_wallet,
    isContainerized: row.is_containerized || false,
    containerIp: row.container_ip || undefined,
    deployStatus: row.deploy_status || 'pending',
    deployPhase: row.deploy_phase || undefined,
    deployError: row.deploy_error || undefined,
    sdkKey: row.sdk_key || undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function generateSdkKey(): string {
  return `bh_agent_${crypto.randomBytes(16).toString('hex')}`;
}

class AgentStorage {
  private cache: Map<string, StoredAgent> = new Map();
  private sdkKeyIndex: Map<string, string> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!pool) {
      console.warn('[storage] No DATABASE_URL, storage disabled');
      this.initialized = true;
      return;
    }
    await pool.query(SCHEMA_SQL);
    await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS sdk_key TEXT');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agents_sdk_key ON agents(sdk_key)');
    await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS deploy_status TEXT DEFAULT \'pending\'');
    await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS deploy_phase TEXT');
    await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS deploy_error TEXT');
    await this.loadCache();
    await this.backfillSdkKeys();
    this.initialized = true;
    console.log(`[storage] Initialized with ${this.cache.size} agents from PostgreSQL`);
  }

  private async loadCache(): Promise<void> {
    if (!pool) return;
    const { rows } = await pool.query('SELECT * FROM agents');
    this.cache.clear();
    this.sdkKeyIndex.clear();
    for (const row of rows) {
      const agent = rowToStored(row);
      this.cache.set(agent.vault, agent);
      if (agent.sdkKey) this.sdkKeyIndex.set(agent.sdkKey, agent.vault);
    }
  }

  private async backfillSdkKeys(): Promise<void> {
    if (!pool) return;
    let count = 0;
    for (const [vault, agent] of this.cache) {
      if (agent.sdkKey) continue;
      const key = generateSdkKey();
      await pool.query('UPDATE agents SET sdk_key = $1 WHERE vault = $2 AND sdk_key IS NULL', [key, vault]);
      agent.sdkKey = key;
      this.sdkKeyIndex.set(key, vault);
      count++;
    }
    if (count > 0) console.log(`[storage] Backfilled SDK keys for ${count} agents`);
  }

  async create(agent: AgentConfig, ownerWallet: string): Promise<StoredAgent> {
    let agentWallet = agent.agentWallet;
    let walletSecretKey = agent.walletSecretKey;

    if (!agentWallet || !walletSecretKey) {
      const keypair = Keypair.generate();
      agentWallet = keypair.publicKey.toBase58();
      walletSecretKey = JSON.stringify(Array.from(keypair.secretKey));
      console.log(`[storage] Generated wallet for agent vault=${agent.vault}: ${agentWallet}`);
    }

    const apiKeyEnc = agent.apiKey ? encrypt(agent.apiKey) : '';
    const walletKeyEnc = encrypt(walletSecretKey);
    const sdkKey = generateSdkKey();

    if (pool) {
      await pool.query(
        `INSERT INTO agents (vault, agent_id, name, system_prompt, price_usdc_micro, model, operator, registry, is_active, api_key_encrypted, agent_wallet, wallet_secret_key_encrypted, owner_wallet, is_containerized, container_ip, sdk_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (vault) DO UPDATE SET
           agent_id = COALESCE(NULLIF(EXCLUDED.agent_id,''), agents.agent_id),
           name = EXCLUDED.name,
           system_prompt = EXCLUDED.system_prompt,
           price_usdc_micro = EXCLUDED.price_usdc_micro,
           model = EXCLUDED.model,
           operator = EXCLUDED.operator,
           registry = EXCLUDED.registry,
           is_active = EXCLUDED.is_active,
           api_key_encrypted = CASE WHEN EXCLUDED.api_key_encrypted = '' THEN agents.api_key_encrypted ELSE EXCLUDED.api_key_encrypted END,
           agent_wallet = COALESCE(EXCLUDED.agent_wallet, agents.agent_wallet),
           wallet_secret_key_encrypted = COALESCE(EXCLUDED.wallet_secret_key_encrypted, agents.wallet_secret_key_encrypted),
           owner_wallet = EXCLUDED.owner_wallet,
           is_containerized = EXCLUDED.is_containerized,
           container_ip = EXCLUDED.container_ip,
           sdk_key = COALESCE(agents.sdk_key, EXCLUDED.sdk_key),
           updated_at = now()`,
        [
          agent.vault, agent.agentId || null, agent.name, agent.systemPrompt,
          agent.priceUsdcMicro, agent.model, agent.operator, agent.registry || null,
          agent.isActive, apiKeyEnc, agentWallet, walletKeyEnc, ownerWallet,
          agent.isContainerized || false, agent.containerIp || null, sdkKey,
        ]
      );
    }

    const stored: StoredAgent = {
      ...agent,
      apiKey: apiKeyEnc,
      agentWallet,
      walletSecretKey: walletKeyEnc,
      ownerWallet,
      sdkKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.cache.set(agent.vault, stored);
    this.sdkKeyIndex.set(sdkKey, agent.vault);
    return { ...stored, apiKey: agent.apiKey, walletSecretKey };
  }

  async createMinimal(vault: string, agentId: string, name: string, operator: string, registry: string, _isActive: boolean): Promise<void> {
    if (pool) {
      await pool.query(
        `INSERT INTO agents (vault, agent_id, name, operator, registry, is_active, owner_wallet, system_prompt)
         VALUES ($1,$2,$3,$4,$5,false,$4,'')
         ON CONFLICT (vault) DO NOTHING`,
        [vault, agentId, name, operator, registry]
      );
    }
    if (!this.cache.has(vault)) {
      this.cache.set(vault, {
        agentId, name, systemPrompt: '', priceUsdcMicro: 100000,
        model: 'claude-sonnet-4-20250514', operator, vault, registry,
        isActive: false, apiKey: '', ownerWallet: operator,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
  }

  async update(id: string, updates: Partial<AgentConfig>): Promise<StoredAgent | null> {
    const existing = this.resolve(id);
    if (!existing) return null;
    const vault = existing.vault;

    const encUpdates = { ...updates };
    if (updates.apiKey) encUpdates.apiKey = encrypt(updates.apiKey);

    const updated: StoredAgent = { ...existing, ...encUpdates, updatedAt: Date.now() };
    this.cache.set(vault, updated);

    if (pool) {
      const sets: string[] = [];
      const vals: any[] = [];
      let i = 1;
      const map: Record<string, string> = {
        name: 'name', systemPrompt: 'system_prompt', priceUsdcMicro: 'price_usdc_micro',
        model: 'model', operator: 'operator', registry: 'registry', isActive: 'is_active',
        isContainerized: 'is_containerized', containerIp: 'container_ip',
        deployStatus: 'deploy_status', deployPhase: 'deploy_phase', deployError: 'deploy_error',
      };
      for (const [key, col] of Object.entries(map)) {
        if ((updates as any)[key] !== undefined) {
          sets.push(`${col} = $${i++}`);
          vals.push((updates as any)[key]);
        }
      }
      if (updates.apiKey) {
        sets.push(`api_key_encrypted = $${i++}`);
        vals.push(encUpdates.apiKey);
      }
      if (sets.length > 0) {
        sets.push(`updated_at = now()`);
        vals.push(vault);
        await pool.query(`UPDATE agents SET ${sets.join(', ')} WHERE vault = $${i}`, vals);
      }
    }

    return this.decryptAgent(updated);
  }

  private decryptAgent(agent: StoredAgent): StoredAgent {
    const result = { ...agent };
    try {
      if (agent.apiKey && isEncrypted(agent.apiKey)) result.apiKey = decrypt(agent.apiKey);
    } catch {
      result.apiKey = '';
    }
    try {
      if (agent.walletSecretKey && isEncrypted(agent.walletSecretKey)) result.walletSecretKey = decrypt(agent.walletSecretKey);
    } catch {
      result.walletSecretKey = '';
    }
    return result;
  }

  private resolve(id: string): StoredAgent | null {
    if (this.cache.has(id)) return this.cache.get(id)!;
    for (const agent of this.cache.values()) {
      if (agent.agentId === id) return agent;
    }
    return null;
  }

  getKeypair(id: string): Keypair | null {
    const agent = this.get(id);
    if (!agent?.walletSecretKey) return null;
    try {
      const secretKey = Uint8Array.from(JSON.parse(agent.walletSecretKey));
      return Keypair.fromSecretKey(secretKey);
    } catch {
      return null;
    }
  }

  get(id: string): StoredAgent | null {
    const agent = this.resolve(id);
    if (!agent) return null;
    return this.decryptAgent(agent);
  }

  async getAsync(id: string): Promise<StoredAgent | null> {
    let agent = this.resolve(id);
    if (!agent && pool) {
      const { rows } = await pool.query(
        'SELECT * FROM agents WHERE vault = $1 OR agent_id = $1 LIMIT 1', [id]
      );
      if (rows.length > 0) {
        agent = rowToStored(rows[0]);
        this.cache.set(agent.vault, agent);
      }
    }
    if (!agent) return null;
    return this.decryptAgent(agent);
  }

  getByOwner(ownerWallet: string): StoredAgent[] {
    return Array.from(this.cache.values())
      .filter(a => a.ownerWallet === ownerWallet)
      .map(a => this.decryptAgent(a));
  }

  getAll(): StoredAgent[] {
    return Array.from(this.cache.values()).map(a => this.decryptAgent(a));
  }

  getBySdkKey(sdkKey: string): StoredAgent | null {
    const vault = this.sdkKeyIndex.get(sdkKey);
    if (!vault) return null;
    const agent = this.cache.get(vault);
    if (!agent) return null;
    return this.decryptAgent(agent);
  }

  async delete(id: string): Promise<boolean> {
    const agent = this.resolve(id);
    if (!agent) return false;
    this.cache.delete(agent.vault);
    if (pool) {
      await pool.query('DELETE FROM agents WHERE vault = $1', [agent.vault]);
    }
    return true;
  }
}

export const agentStorage = new AgentStorage();
