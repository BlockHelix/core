import Database from 'better-sqlite3';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

export interface MemoryEntry {
  id: number;
  content: string;
  category: string;
  tags: string[];
  similarity: number;
  createdAt: number;
}

export class EmbeddingMemory {
  private db: Database.Database;
  private openai: OpenAI;
  private contextId: string;

  constructor(contextId: string = 'default') {
    this.contextId = contextId;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const dataDir = process.env.MEMORY_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'memory.db');
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        context_id TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_context ON memories(context_id);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    `);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private embeddingToBuffer(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4);
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4);
    }
    return buffer;
  }

  private bufferToEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i));
    }
    return embedding;
  }

  async store(content: string, category: string, tags: string[] = []): Promise<number> {
    const embedding = await this.getEmbedding(content);
    const embeddingBuffer = this.embeddingToBuffer(embedding);

    const stmt = this.db.prepare(`
      INSERT INTO memories (context_id, content, category, tags, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      this.contextId,
      content,
      category,
      JSON.stringify(tags),
      embeddingBuffer,
      Date.now()
    );

    return result.lastInsertRowid as number;
  }

  async search(query: string, limit: number = 5, category?: string): Promise<MemoryEntry[]> {
    const queryEmbedding = await this.getEmbedding(query);

    let sql = 'SELECT id, content, category, tags, embedding, created_at FROM memories WHERE context_id = ?';
    const params: (string | number)[] = [this.contextId];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number;
      content: string;
      category: string;
      tags: string;
      embedding: Buffer;
      created_at: number;
    }>;

    const scored = rows.map(row => {
      const embedding = this.bufferToEmbedding(row.embedding);
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      return {
        id: row.id,
        content: row.content,
        category: row.category,
        tags: JSON.parse(row.tags) as string[],
        similarity,
        createdAt: row.created_at,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit).filter(m => m.similarity > 0.3);
  }

  async searchByTags(tags: string[], limit: number = 5): Promise<MemoryEntry[]> {
    const rows = this.db.prepare(`
      SELECT id, content, category, tags, created_at FROM memories
      WHERE context_id = ?
    `).all(this.contextId) as Array<{
      id: number;
      content: string;
      category: string;
      tags: string;
      created_at: number;
    }>;

    const matched = rows.filter(row => {
      const rowTags = JSON.parse(row.tags) as string[];
      return tags.some(t => rowTags.includes(t));
    });

    return matched.slice(0, limit).map(row => ({
      id: row.id,
      content: row.content,
      category: row.category,
      tags: JSON.parse(row.tags) as string[],
      similarity: 1.0,
      createdAt: row.created_at,
    }));
  }

  getStats(): { totalMemories: number; byCategory: Record<string, number> } {
    const total = this.db.prepare(
      'SELECT COUNT(*) as count FROM memories WHERE context_id = ?'
    ).get(this.contextId) as { count: number };

    const categories = this.db.prepare(`
      SELECT category, COUNT(*) as count FROM memories
      WHERE context_id = ? GROUP BY category
    `).all(this.contextId) as Array<{ category: string; count: number }>;

    const byCategory: Record<string, number> = {};
    for (const row of categories) {
      byCategory[row.category] = row.count;
    }

    return { totalMemories: total.count, byCategory };
  }

  close() {
    this.db.close();
  }
}

const memoryInstances = new Map<string, EmbeddingMemory>();

export function getSharedMemory(contextId: string = 'default'): EmbeddingMemory {
  let memory = memoryInstances.get(contextId);
  if (!memory) {
    memory = new EmbeddingMemory(contextId);
    memoryInstances.set(contextId, memory);
  }
  return memory;
}
