import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { searchWeb, fetchPage } from './web';
import { EmbeddingMemory, getSharedMemory } from './embedding-memory';

export type ToolName = 'memory_search' | 'memory_store' | 'web_search' | 'web_fetch' | 'file_read' | 'file_list';

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export const GENERAL_TOOL_DEFINITIONS: Record<ToolName, Anthropic.Tool> = {
  memory_search: {
    name: 'memory_search',
    description: 'Search semantic memory for past work, notes, findings, and learnings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
  memory_store: {
    name: 'memory_store',
    description: 'Save notes, findings, or learnings to memory for future reference.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Content to store' },
        category: { type: 'string', enum: ['finding', 'note', 'pattern', 'learning', 'research'], description: 'Category' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
      },
      required: ['content', 'category'],
    },
  },
  web_search: {
    name: 'web_search',
    description: 'Search the web for information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
  web_fetch: {
    name: 'web_fetch',
    description: 'Fetch and read a web page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  file_read: {
    name: 'file_read',
    description: 'Read a file from the workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Path relative to workspace root' },
      },
      required: ['filePath'],
    },
  },
  file_list: {
    name: 'file_list',
    description: 'List files in the workspace directory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dirPath: { type: 'string', description: 'Directory path relative to workspace (empty for root)' },
        recursive: { type: 'boolean', description: 'List recursively (default false)' },
      },
      required: [],
    },
  },
};

export function getToolDefinitions(toolNames: ToolName[]): Anthropic.Tool[] {
  return toolNames.map(name => GENERAL_TOOL_DEFINITIONS[name]).filter(Boolean);
}

export class GeneralToolExecutor {
  private memory: EmbeddingMemory | null = null;
  private agentId: string;
  private workspacePath: string | null;

  constructor(agentId: string, workspacePath?: string) {
    this.agentId = agentId;
    this.workspacePath = workspacePath || null;
  }

  private getMemory(): EmbeddingMemory {
    if (!this.memory) {
      this.memory = getSharedMemory(this.agentId);
    }
    return this.memory;
  }

  async execute(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'memory_search':
          return await this.memorySearch(input.query as string, input.limit as number | undefined);
        case 'memory_store':
          return await this.memoryStore(input.content as string, input.category as string, input.tags as string[] | undefined);
        case 'web_search':
          return await this.webSearch(input.query as string, input.maxResults as number | undefined);
        case 'web_fetch':
          return await this.webFetch(input.url as string);
        case 'file_read':
          return this.fileRead(input.filePath as string);
        case 'file_list':
          return this.fileList(input.dirPath as string | undefined, input.recursive as boolean | undefined);
        default:
          return { content: `Unknown tool: ${toolName}`, isError: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { content: `Tool error: ${msg}`, isError: true };
    }
  }

  private async memorySearch(query: string, limit?: number): Promise<ToolResult> {
    const results = await this.getMemory().search(query, limit || 5);
    if (results.length === 0) {
      return { content: 'No relevant memories found.' };
    }
    const formatted = results.map((r, i) =>
      `[${i + 1}] (${r.category}, score: ${r.similarity.toFixed(3)})\n${r.content}\nTags: ${r.tags.join(', ')}`
    ).join('\n\n');
    return { content: formatted };
  }

  private async memoryStore(content: string, category: string, tags?: string[]): Promise<ToolResult> {
    await this.getMemory().store(content, category, tags || []);
    return { content: `Stored: "${content.slice(0, 50)}..." [${category}]` };
  }

  private async webSearch(query: string, maxResults?: number): Promise<ToolResult> {
    const results = await searchWeb(query, maxResults || 5);
    if (results.length === 0) {
      return { content: 'No search results found.' };
    }
    const formatted = results.map((r, i) =>
      `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`
    ).join('\n\n');
    return { content: formatted };
  }

  private async webFetch(url: string): Promise<ToolResult> {
    const page = await fetchPage(url);
    if (!page) {
      return { content: 'Failed to fetch page.', isError: true };
    }
    const truncated = page.content.slice(0, 15000);
    return { content: `Title: ${page.title}\n\n${truncated}` };
  }

  private fileRead(filePath: string): ToolResult {
    if (!this.workspacePath) {
      return { content: 'No workspace configured for file operations.', isError: true };
    }

    const fullPath = path.join(this.workspacePath, filePath);
    const normalizedFull = path.normalize(fullPath);
    const normalizedWorkspace = path.normalize(this.workspacePath);

    if (!normalizedFull.startsWith(normalizedWorkspace)) {
      return { content: 'Access denied: path outside workspace', isError: true };
    }

    if (!fs.existsSync(fullPath)) {
      return { content: `File not found: ${filePath}`, isError: true };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return { content: 'Path is a directory, use file_list instead', isError: true };
    }

    if (stat.size > 100000) {
      return { content: `File too large (${stat.size} bytes), max 100KB`, isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return { content };
  }

  private fileList(dirPath?: string, recursive?: boolean): ToolResult {
    if (!this.workspacePath) {
      return { content: 'No workspace configured for file operations.', isError: true };
    }

    const targetDir = path.join(this.workspacePath, dirPath || '');
    const normalizedTarget = path.normalize(targetDir);
    const normalizedWorkspace = path.normalize(this.workspacePath);

    if (!normalizedTarget.startsWith(normalizedWorkspace)) {
      return { content: 'Access denied: path outside workspace', isError: true };
    }

    if (!fs.existsSync(targetDir)) {
      return { content: `Directory not found: ${dirPath || '/'}`, isError: true };
    }

    const files: string[] = [];
    const maxFiles = 200;

    const walk = (dir: string, depth: number) => {
      if (files.length >= maxFiles) return;
      if (!recursive && depth > 0) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) break;
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.workspacePath!, fullPath);

        if (entry.isDirectory()) {
          files.push(`${relativePath}/`);
          if (recursive) walk(fullPath, depth + 1);
        } else {
          files.push(relativePath);
        }
      }
    };

    walk(targetDir, 0);
    files.sort();
    return { content: files.join('\n') };
  }

  getMemoryStats() {
    if (!this.memory) {
      return { totalMemories: 0, byCategory: {} };
    }
    return this.memory.getStats();
  }
}
