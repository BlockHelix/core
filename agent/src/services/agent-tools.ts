import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { searchWeb, fetchPage } from './web';
import { EmbeddingMemory } from './embedding-memory';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'memory_search',
    description: 'Search semantic memory for past analyses, notes, findings, and learnings. Use this to recall relevant information from previous work.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_store',
    description: 'Save notes, findings, or learnings to semantic memory for future reference. Use this to record important discoveries during analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'The content to store',
        },
        category: {
          type: 'string',
          enum: ['finding', 'note', 'pattern', 'learning'],
          description: 'Category of the memory',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
      },
      required: ['content', 'category'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for information about protocols, vulnerabilities, security advisories, or documentation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        maxResults: {
          type: 'number',
          description: 'Max results (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch and read the content of a web page. Use for reading documentation, audit reports, or security advisories.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'repo_read',
    description: 'Read a file from the cloned repository. Use to examine source code.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path relative to repo root',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'repo_list',
    description: 'List files in a directory of the cloned repository.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dirPath: {
          type: 'string',
          description: 'Directory path relative to repo root (empty for root)',
        },
        recursive: {
          type: 'boolean',
          description: 'List recursively (default false)',
        },
      },
      required: [],
    },
  },
];

export class ToolExecutor {
  private repoPath: string;
  private memory: EmbeddingMemory;

  constructor(repoPath: string, memory: EmbeddingMemory) {
    this.repoPath = repoPath;
    this.memory = memory;
  }

  async execute(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'memory_search':
          return await this.memorySearch(input.query as string, input.limit as number | undefined);
        case 'memory_store':
          return await this.memoryStore(
            input.content as string,
            input.category as string,
            input.tags as string[] | undefined
          );
        case 'web_search':
          return await this.webSearch(input.query as string, input.maxResults as number | undefined);
        case 'web_fetch':
          return await this.webFetch(input.url as string);
        case 'repo_read':
          return this.repoRead(input.filePath as string);
        case 'repo_list':
          return this.repoList(input.dirPath as string | undefined, input.recursive as boolean | undefined);
        default:
          return { content: `Unknown tool: ${toolName}`, isError: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { content: `Tool error: ${msg}`, isError: true };
    }
  }

  private async memorySearch(query: string, limit?: number): Promise<ToolResult> {
    const results = await this.memory.search(query, limit || 5);
    if (results.length === 0) {
      return { content: 'No relevant memories found.' };
    }
    const formatted = results.map((r, i) =>
      `[${i + 1}] (${r.category}, score: ${r.similarity.toFixed(3)})\n${r.content}\nTags: ${r.tags.join(', ')}`
    ).join('\n\n');
    return { content: formatted };
  }

  private async memoryStore(content: string, category: string, tags?: string[]): Promise<ToolResult> {
    await this.memory.store(content, category, tags || []);
    return { content: `Stored memory: "${content.slice(0, 50)}..." with category=${category}` };
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
      return { content: 'Failed to fetch page or page is not readable.', isError: true };
    }
    const truncated = page.content.slice(0, 15000);
    return { content: `Title: ${page.title}\n\n${truncated}` };
  }

  private repoRead(filePath: string): ToolResult {
    const fullPath = path.join(this.repoPath, filePath);
    const normalizedFull = path.normalize(fullPath);
    const normalizedRepo = path.normalize(this.repoPath);

    if (!normalizedFull.startsWith(normalizedRepo)) {
      return { content: 'Access denied: path outside repository', isError: true };
    }

    if (!fs.existsSync(fullPath)) {
      return { content: `File not found: ${filePath}`, isError: true };
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return { content: 'Path is a directory, use repo_list instead', isError: true };
    }

    if (stat.size > 100000) {
      return { content: `File too large (${stat.size} bytes), max 100KB`, isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return { content };
  }

  private repoList(dirPath?: string, recursive?: boolean): ToolResult {
    const targetDir = path.join(this.repoPath, dirPath || '');
    const normalizedTarget = path.normalize(targetDir);
    const normalizedRepo = path.normalize(this.repoPath);

    if (!normalizedTarget.startsWith(normalizedRepo)) {
      return { content: 'Access denied: path outside repository', isError: true };
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
        const relativePath = path.relative(this.repoPath, fullPath);

        if (entry.isDirectory()) {
          files.push(`${relativePath}/`);
          if (recursive) {
            walk(fullPath, depth + 1);
          }
        } else {
          files.push(relativePath);
        }
      }
    };

    walk(targetDir, 0);
    files.sort();

    return { content: files.join('\n') };
  }
}
