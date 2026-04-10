import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import type { Express, Request, Response } from 'express';
import { agentStorage } from './services/storage';
import { getVaultState } from './services/mood-state';
import { getAllHostedAgents, getAgentConfig } from './services/agent-config';
import { eventIndexer } from './services/event-indexer';
import { containerManager } from './services/container-manager';

const API_BASE = process.env.PUBLIC_URL || 'https://agents.blockhelix.tech';

export function mountMcp(app: Express) {
  const server = new McpServer({
    name: 'BlockHelix',
    version: '1.0.0',
  });

  // --- Tools ---

  server.tool(
    'list_vaults',
    'Browse all active vault-agents on the BlockHelix network. Returns name, price, jobs, and stats for each.',
    {},
    async () => {
      const agents = getAllHostedAgents().filter(a => a.isActive && a.name);
      const vaults = agents.map(a => a.vault).filter(Boolean) as string[];
      const statsMap = await eventIndexer.getStatsForVaults(vaults);
      const list = agents.map(a => {
        const s = a.vault ? statsMap.get(a.vault) : undefined;
        return {
          id: a.agentId,
          name: a.name,
          priceUsdc: (a.priceUsdcMicro || 0) / 1_000_000,
          totalJobs: s?.totalJobs || 0,
          totalRevenue: s?.totalRevenue || 0,
          active: a.isActive,
        };
      });
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    },
  );

  server.tool(
    'get_vault_state',
    'Get the live state of a specific vault: mood, level, jobs, age, last activity.',
    { vault_id: z.string().describe('The vault/agent ID') },
    async ({ vault_id }) => {
      const state = await getVaultState(vault_id);
      if (!state) return { content: [{ type: 'text', text: `Vault ${vault_id} not found or has no state` }] };
      return { content: [{ type: 'text', text: JSON.stringify(state, null, 2) }] };
    },
  );

  server.tool(
    'hire_vault',
    'Send a task to a vault-agent and get the result. May require USDC payment via x402 if the vault charges.',
    {
      vault_id: z.string().describe('The vault/agent ID to hire'),
      task: z.string().describe('The task description / input for the agent'),
    },
    async ({ vault_id, task }) => {
      const agent = await getAgentConfig(vault_id);
      if (!agent) return { content: [{ type: 'text', text: `Vault ${vault_id} not found` }] };
      if (!agent.isActive) return { content: [{ type: 'text', text: `Vault ${vault_id} is not active` }] };

      // Try container path first
      if (agent.isContainerized && agent.containerIp) {
        try {
          const resp = await containerManager.proxyRequest(vault_id, { input: task }, agent.containerIp);
          return { content: [{ type: 'text', text: resp.output }] };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Container error: ${err?.message}` }] };
        }
      }

      // Fallback: direct LLM call
      if (agent.apiKey) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: agent.apiKey });
        const msg = await anthropic.messages.create({
          model: agent.model || 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: agent.systemPrompt || `You are ${agent.name}.`,
          messages: [{ role: 'user', content: task }],
        });
        const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
        return { content: [{ type: 'text', text }] };
      }

      return { content: [{ type: 'text', text: `Vault ${vault_id} has no API key configured` }] };
    },
  );

  server.tool(
    'create_vault',
    'Create a new vault-agent on BlockHelix. Returns the vault ID and URLs. The vault starts earning from public chat immediately.',
    {
      name: z.string().describe('Name for the vault-agent'),
      purpose: z.string().describe('What the agent does — this becomes its system prompt'),
      api_key: z.string().describe('Anthropic API key (sk-ant-...)'),
      price_per_message: z.number().optional().describe('Price in USDC per public chat message (default 0.10)'),
      archetype: z.string().optional().describe('Agent archetype: researcher, trader, writer, coder, generalist'),
    },
    async ({ name, purpose, api_key, price_per_message, archetype }) => {
      if (!api_key.startsWith('sk-ant-')) {
        return { content: [{ type: 'text', text: 'Error: API key must start with sk-ant-' }] };
      }
      const priceMicro = Math.floor((price_per_message ?? 0.10) * 1_000_000);
      const vaultId = `self-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      try {
        await agentStorage.create({
          agentId: vaultId,
          name,
          systemPrompt: purpose,
          priceUsdcMicro: priceMicro,
          model: 'claude-sonnet-4-20250514',
          operator: '',
          vault: vaultId,
          registry: '',
          isActive: true,
          apiKey: api_key,
          isContainerized: false,
          taskDescription: purpose,
          budgetTotalMicro: 0,
          budgetSpentMicro: 0,
          budgetReservedMicro: 0,
          approvalThresholdMicro: 5_000_000,
          taskStatus: 'running',
        }, '');
        await agentStorage.update(vaultId, {
          purposeMd: purpose,
          archetype: (archetype || 'generalist') as any,
        });
        eventIndexer.refreshMappings();

        const result = {
          vault_id: vaultId,
          name,
          price: priceMicro / 1_000_000,
          chat_url: `${API_BASE}/v1/vaults/${vaultId}/chat`,
          run_url: `${API_BASE}/v1/agent/${vaultId}/run`,
          page_url: `https://blockhelix.tech/v/${vaultId}`,
        };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err?.message}` }] };
      }
    },
  );

  server.tool(
    'chat_with_vault',
    'Have a conversation with a vault-agent. Sends a message and returns the response. For multi-turn, pass previous messages in history.',
    {
      vault_id: z.string().describe('The vault/agent ID'),
      message: z.string().describe('Your message to the vault'),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('Previous conversation turns for context'),
    },
    async ({ vault_id, message, history }) => {
      const agent = await agentStorage.getAsync(vault_id);
      if (!agent) return { content: [{ type: 'text', text: `Vault ${vault_id} not found` }] };

      const apiKey = agent.apiKey;
      if (!apiKey) return { content: [{ type: 'text', text: 'Vault has no API key' }] };

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey });
      const messages = [
        ...(history || []),
        { role: 'user' as const, content: message },
      ];
      const msg = await anthropic.messages.create({
        model: agent.model || 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: agent.purposeMd || agent.systemPrompt || `You are ${agent.name}.`,
        messages,
      });
      const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      return { content: [{ type: 'text', text }] };
    },
  );

  // --- Mount on Express via SSE transport ---
  // MCP over SSE: client connects to GET /mcp/sse for the event stream,
  // sends requests to POST /mcp/messages.

  const transports: Map<string, SSEServerTransport> = new Map();

  app.get('/mcp/sse', async (req: Request, res: Response) => {
    const transport = new SSEServerTransport('/mcp/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await server.connect(transport);
  });

  app.post('/mcp/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: 'invalid session' });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  console.log('[mcp] BlockHelix MCP server mounted at /mcp/sse');
}
