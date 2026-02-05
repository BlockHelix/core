import fs from 'fs';
import path from 'path';
import type { AgentConfig } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');

export interface StoredAgent extends AgentConfig {
  ownerWallet: string;
  createdAt: number;
  updatedAt: number;
}

class AgentStorage {
  private agents: Map<string, StoredAgent> = new Map();

  constructor() {
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(AGENTS_FILE)) {
        const data = fs.readFileSync(AGENTS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.agents = new Map(Object.entries(parsed));
        console.log(`[storage] Loaded ${this.agents.size} agents from storage`);
      }
    } catch (error) {
      console.error('[storage] Failed to load agents:', error instanceof Error ? error.message : error);
      this.agents = new Map();
    }
  }

  private save(): void {
    try {
      const data = JSON.stringify(Object.fromEntries(this.agents), null, 2);
      fs.writeFileSync(AGENTS_FILE, data, 'utf-8');
    } catch (error) {
      console.error('[storage] Failed to save agents:', error instanceof Error ? error.message : error);
    }
  }

  create(agent: AgentConfig, ownerWallet: string): StoredAgent {
    const stored: StoredAgent = {
      ...agent,
      ownerWallet,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.agents.set(agent.agentId, stored);
    this.save();
    return stored;
  }

  update(agentId: string, updates: Partial<AgentConfig>): StoredAgent | null {
    const existing = this.agents.get(agentId);
    if (!existing) return null;

    const updated: StoredAgent = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    this.agents.set(agentId, updated);
    this.save();
    return updated;
  }

  get(agentId: string): StoredAgent | null {
    return this.agents.get(agentId) || null;
  }

  getByOwner(ownerWallet: string): StoredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.ownerWallet === ownerWallet
    );
  }

  getAll(): StoredAgent[] {
    return Array.from(this.agents.values());
  }

  delete(agentId: string): boolean {
    const deleted = this.agents.delete(agentId);
    if (deleted) {
      this.save();
    }
    return deleted;
  }
}

export const agentStorage = new AgentStorage();
