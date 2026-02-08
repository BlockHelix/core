import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Keypair } from '@solana/web3.js';
import type { AgentConfig } from '../types';
import { encrypt, decrypt, isEncrypted } from './crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const S3_BUCKET = process.env.STORAGE_BUCKET || 'blockhelix-dev-storage';
const S3_KEY = 'agents.json';
const USE_S3 = process.env.USE_S3_STORAGE === 'true';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export interface StoredAgent extends AgentConfig {
  ownerWallet: string;
  createdAt: number;
  updatedAt: number;
}

class AgentStorage {
  private agents: Map<string, StoredAgent> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.load();
    this.initialized = true;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private async load(): Promise<void> {
    if (USE_S3) {
      await this.loadFromS3();
    } else {
      this.loadFromFile();
    }
  }

  private async loadFromS3(): Promise<void> {
    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: S3_KEY,
      }));
      const body = await response.Body?.transformToString();
      if (body) {
        const parsed = JSON.parse(body);
        this.agents = new Map(Object.entries(parsed));
        console.log(`[storage] Loaded ${this.agents.size} agents from S3`);
      }
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        console.log('[storage] No agents.json in S3 yet, starting fresh');
      } else {
        console.error('[storage] Failed to load from S3:', error.message);
      }
      this.agents = new Map();
    }
  }

  private loadFromFile(): void {
    this.ensureDataDir();
    try {
      if (fs.existsSync(AGENTS_FILE)) {
        const data = fs.readFileSync(AGENTS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.agents = new Map(Object.entries(parsed));
        console.log(`[storage] Loaded ${this.agents.size} agents from file`);
      }
    } catch (error) {
      console.error('[storage] Failed to load from file:', error instanceof Error ? error.message : error);
      this.agents = new Map();
    }
  }

  private async save(): Promise<void> {
    const data = JSON.stringify(Object.fromEntries(this.agents), null, 2);
    if (USE_S3) {
      await this.saveToS3(data);
    }
    this.saveToFile(data);
  }

  private async saveToS3(data: string): Promise<void> {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: S3_KEY,
        Body: data,
        ContentType: 'application/json',
      }));
      console.log('[storage] Saved agents to S3');
    } catch (error) {
      console.error('[storage] Failed to save to S3:', error instanceof Error ? error.message : error);
    }
  }

  private saveToFile(data: string): void {
    this.ensureDataDir();
    try {
      fs.writeFileSync(AGENTS_FILE, data, 'utf-8');
    } catch (error) {
      console.error('[storage] Failed to save to file:', error instanceof Error ? error.message : error);
    }
  }

  async create(agent: AgentConfig, ownerWallet: string): Promise<StoredAgent> {
    let agentWallet = agent.agentWallet;
    let walletSecretKey = agent.walletSecretKey;

    if (!agentWallet || !walletSecretKey) {
      const keypair = Keypair.generate();
      agentWallet = keypair.publicKey.toBase58();
      walletSecretKey = JSON.stringify(Array.from(keypair.secretKey));
      console.log(`[storage] Generated new wallet for agent ${agent.agentId}: ${agentWallet}`);
    }

    const stored: StoredAgent = {
      ...agent,
      apiKey: agent.apiKey ? encrypt(agent.apiKey) : '',
      agentWallet,
      walletSecretKey: encrypt(walletSecretKey),
      ownerWallet,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.agents.set(agent.agentId, stored);
    await this.save();
    return { ...stored, apiKey: agent.apiKey, walletSecretKey };
  }

  async update(agentId: string, updates: Partial<AgentConfig>): Promise<StoredAgent | null> {
    const existing = this.agents.get(agentId);
    if (!existing) return null;

    const encryptedUpdates = { ...updates };
    if (updates.apiKey) {
      encryptedUpdates.apiKey = encrypt(updates.apiKey);
    }

    const updated: StoredAgent = {
      ...existing,
      ...encryptedUpdates,
      updatedAt: Date.now(),
    };
    this.agents.set(agentId, updated);
    await this.save();
    return this.decryptAgent(updated);
  }

  private decryptAgent(agent: StoredAgent): StoredAgent {
    const result = { ...agent };
    try {
      if (agent.apiKey && isEncrypted(agent.apiKey)) {
        result.apiKey = decrypt(agent.apiKey);
      }
    } catch {
      console.error(`[storage] Failed to decrypt apiKey for agent ${agent.agentId}`);
      result.apiKey = '';
    }
    try {
      if (agent.walletSecretKey && isEncrypted(agent.walletSecretKey)) {
        result.walletSecretKey = decrypt(agent.walletSecretKey);
      }
    } catch {
      console.error(`[storage] Failed to decrypt walletSecretKey for agent ${agent.agentId}`);
      result.walletSecretKey = '';
    }
    return result;
  }

  getKeypair(agentId: string): Keypair | null {
    const agent = this.get(agentId);
    if (!agent?.walletSecretKey) return null;
    try {
      const secretKey = Uint8Array.from(JSON.parse(agent.walletSecretKey));
      return Keypair.fromSecretKey(secretKey);
    } catch {
      console.error(`[storage] Failed to load keypair for agent ${agentId}`);
      return null;
    }
  }

  get(agentId: string): StoredAgent | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    return this.decryptAgent(agent);
  }

  async getAsync(agentId: string): Promise<StoredAgent | null> {
    let agent = this.agents.get(agentId);
    if (!agent && USE_S3) {
      console.log(`[storage] Agent ${agentId} not in memory, reloading from S3...`);
      await this.loadFromS3();
      agent = this.agents.get(agentId);
    }
    if (!agent) return null;
    return this.decryptAgent(agent);
  }

  getByOwner(ownerWallet: string): StoredAgent[] {
    return Array.from(this.agents.values())
      .filter((agent) => agent.ownerWallet === ownerWallet)
      .map((agent) => this.decryptAgent(agent));
  }

  getAll(): StoredAgent[] {
    return Array.from(this.agents.values()).map((agent) => this.decryptAgent(agent));
  }

  async delete(agentId: string): Promise<boolean> {
    const deleted = this.agents.delete(agentId);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }
}

export const agentStorage = new AgentStorage();
