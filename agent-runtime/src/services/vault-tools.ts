import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { RPC_URL, USDC_MINT } from '../config';
import { getVaultState } from './mood-state';
import { pool } from './db';

const knowledgeS3 = new S3Client({});
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET || 'blockhelix-dev-storage';

// The tool layer is intentionally tiny and read-only for v1. No writes, no
// signing, no spending. The point is to ground the vault in its actual
// on-chain and in-db state so it stops hallucinating and starts being useful.

export interface ToolContext {
  agent: {
    vault: string;
    name: string;
    agentWallet?: string;
  };
  isOwner: boolean;
}

export interface VaultTool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, any>; required?: string[] };
  ownerOnly?: boolean;
  run: (input: any, ctx: ToolContext) => Promise<unknown>;
}

let sharedConnection: Connection | null = null;
function connection(): Connection {
  if (!sharedConnection) sharedConnection = new Connection(RPC_URL, 'confirmed');
  return sharedConnection;
}

const get_vault_stats: VaultTool = {
  name: 'get_vault_stats',
  description:
    'Returns the vault\'s current live stats: mood, level, title, total and today\'s jobs, total and today\'s chats, days alive, minutes since last activity. Use this whenever you need to speak about your own state — it is the authoritative source, do not guess.',
  input_schema: { type: 'object', properties: {} },
  run: async (_input, ctx) => {
    const state = await getVaultState(ctx.agent.vault);
    if (!state) return { error: 'vault state unavailable' };
    return state;
  },
};

const get_wallet_balance: VaultTool = {
  name: 'get_wallet_balance',
  description:
    'Returns the vault\'s actual on-chain SOL and USDC balances from the Solana RPC. Use this when asked "how much money do you have" or before proposing any spending. These are real numbers from the chain — never fabricate balances.',
  input_schema: { type: 'object', properties: {} },
  run: async (_input, ctx) => {
    if (!ctx.agent.agentWallet) return { error: 'no agent wallet address on file' };
    try {
      const pubkey = new PublicKey(ctx.agent.agentWallet);
      const conn = connection();
      const lamports = await conn.getBalance(pubkey);
      const sol = lamports / LAMPORTS_PER_SOL;

      let usdc = 0;
      try {
        const resp = await conn.getParsedTokenAccountsByOwner(pubkey, { mint: USDC_MINT });
        for (const acc of resp.value) {
          const amt = acc.account.data.parsed?.info?.tokenAmount?.uiAmount;
          if (typeof amt === 'number') usdc += amt;
        }
      } catch {
        /* no USDC account yet */
      }

      return {
        address: ctx.agent.agentWallet,
        sol: Number(sol.toFixed(6)),
        usdc: Number(usdc.toFixed(6)),
      };
    } catch (err: any) {
      return { error: err?.message || 'balance lookup failed' };
    }
  },
};

const list_recent_jobs: VaultTool = {
  name: 'list_recent_jobs',
  description:
    'Returns the 10 most recent jobs the vault has completed from the job_receipts ledger, with amount, recipient, reason, and timestamp. Use this to ground statements about "what I\'ve been working on" in reality.',
  input_schema: { type: 'object', properties: {} },
  run: async (_input, ctx) => {
    if (!pool) return { jobs: [] };
    const { rows } = await pool.query(
      `SELECT job_id, client, payment_amount, status, created_at, tx_signature
         FROM job_receipts
        WHERE vault = $1
        ORDER BY created_at DESC
        LIMIT 10`,
      [ctx.agent.vault],
    );
    return {
      jobs: rows.map((r) => ({
        jobId: Number(r.job_id),
        client: r.client,
        amountUsdc: Number(r.payment_amount || 0) / 1_000_000,
        status: r.status,
        createdAt: new Date(Number(r.created_at)).toISOString(),
        txSignature: r.tx_signature,
      })),
    };
  },
};

const fetch_url: VaultTool = {
  name: 'fetch_url',
  description:
    'Fetches a URL with GET and returns its text body (truncated to 20KB). Use this to actually look at a web page, feed, or JSON API. Always include the protocol (https://). This is the vault\'s window to the outside web.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL including protocol' },
    },
    required: ['url'],
  },
  ownerOnly: true,
  run: async (input) => {
    const url = typeof input?.url === 'string' ? input.url : '';
    if (!/^https?:\/\//i.test(url)) return { error: 'url must start with http:// or https://' };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'BlockHelix-Vault/1.0' },
      });
      clearTimeout(timer);
      const text = await res.text();
      const truncated = text.length > 20_000;
      return {
        status: res.status,
        contentType: res.headers.get('content-type') || 'unknown',
        body: text.slice(0, 20_000),
        truncated,
      };
    } catch (err: any) {
      return { error: err?.message || 'fetch failed' };
    }
  },
};

const web_search: VaultTool = {
  name: 'web_search',
  description:
    'Searches the web via Brave Search and returns the top results (title, url, snippet). Use this to find current information — the vault\'s training data is stale, this is how it sees "now". Only available when the runtime has a Brave API key configured.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  ownerOnly: true,
  run: async (input) => {
    const key = process.env.BRAVE_API_KEY;
    if (!key) return { error: 'web_search unavailable — runtime has no BRAVE_API_KEY' };
    const query = typeof input?.query === 'string' ? input.query : '';
    if (!query) return { error: 'query required' };
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } },
      );
      if (!res.ok) return { error: `brave search ${res.status}` };
      const data: any = await res.json();
      const results = (data?.web?.results || []).slice(0, 5).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));
      return { query, results };
    } catch (err: any) {
      return { error: err?.message || 'search failed' };
    }
  },
};

const search_knowledge: VaultTool = {
  name: 'search_knowledge',
  description:
    'Search the vault\'s persistent knowledge base for notes matching a keyword. Returns note titles, tags, and content snippets. Use this before answering domain questions — the vault may already know the answer from prior research.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keyword or topic to search for' },
    },
    required: ['query'],
  },
  run: async (input, ctx) => {
    const query = typeof input?.query === 'string' ? input.query.toLowerCase() : '';
    if (!query) return { error: 'query required' };
    try {
      const prefix = `knowledge/${ctx.agent.vault}/knowledge/`;
      const list = await knowledgeS3.send(new ListObjectsV2Command({
        Bucket: UPLOAD_BUCKET,
        Prefix: prefix,
        MaxKeys: 200,
      }));
      if (!list.Contents || list.Contents.length === 0) {
        return { results: [], message: 'knowledge base is empty — no notes yet' };
      }
      // For each .md file, fetch and check for keyword match
      const matches: Array<{ file: string; title: string; snippet: string }> = [];
      for (const obj of list.Contents) {
        if (!obj.Key || !obj.Key.endsWith('.md') || obj.Key.endsWith('_index.md')) continue;
        try {
          const resp = await knowledgeS3.send(new GetObjectCommand({ Bucket: UPLOAD_BUCKET, Key: obj.Key }));
          const text = await resp.Body?.transformToString('utf-8') || '';
          if (!text.toLowerCase().includes(query)) continue;
          const titleMatch = text.match(/^title:\s*(.+)$/m);
          const title = titleMatch?.[1] || obj.Key.split('/').pop()?.replace('.md', '') || 'untitled';
          const idx = text.toLowerCase().indexOf(query);
          const snippet = text.slice(Math.max(0, idx - 80), idx + 120).replace(/\n/g, ' ').trim();
          matches.push({ file: obj.Key.split('/').pop() || '', title, snippet });
          if (matches.length >= 10) break;
        } catch { /* skip unreadable */ }
      }
      return { query, results: matches, totalNotes: list.Contents.length };
    } catch (err: any) {
      return { error: err?.message || 'knowledge search failed' };
    }
  },
};

const ALL_TOOLS: VaultTool[] = [
  get_vault_stats,
  get_wallet_balance,
  list_recent_jobs,
  fetch_url,
  web_search,
  search_knowledge,
];

export function getToolsFor(ctx: ToolContext): VaultTool[] {
  return ALL_TOOLS.filter((t) => !t.ownerOnly || ctx.isOwner);
}

export function toAnthropicTools(tools: VaultTool[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) return { error: `unknown tool: ${name}` };
  if (tool.ownerOnly && !ctx.isOwner) return { error: 'this tool is owner-only' };
  try {
    return await tool.run(input as any, ctx);
  } catch (err: any) {
    return { error: err?.message || 'tool failed' };
  }
}
