import express from 'express';
import dotenv from 'dotenv';
import { paymentMiddleware } from '@x402/express';
import { routes, resourceServer } from './utils/x402';
import { analyzeCode } from './routes/analyze';
import { generatePatch } from './routes/patch';
import { handleAgentRequest } from './routes/agent';
import { getSharedMemory } from './services/embedding-memory';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS || '';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet'
  ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
  : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

app.use(express.json({ limit: '10mb' }));

const BYPASS_PAYMENT = process.env.BYPASS_PAYMENT === 'true';
if (!BYPASS_PAYMENT) {
  app.use(paymentMiddleware(routes, resourceServer));
} else {
  console.log('⚠️  Payment bypass enabled (testing mode)');
}

app.get('/health', (_req, res) => {
  let memoryStats = { totalMemories: 0, byCategory: {} as Record<string, number> };
  try {
    const memory = getSharedMemory('default');
    memoryStats = memory.getStats();
  } catch { /* memory not initialized yet */ }

  res.json({
    status: 'ok',
    agent: 'BlockHelix Agent Server',
    version: '0.5.0',
    x402: 'v2',
    capabilities: {
      generalAgent: true,
      toolUse: ['memory_search', 'memory_store', 'web_search', 'web_fetch', 'file_read', 'file_list'],
      semanticMemory: true,
      webResearch: true,
    },
    endpoints: {
      '/agent': {
        method: 'POST',
        price: '$0.10 USDC',
        description: 'General-purpose agentic task execution',
        params: {
          agentId: 'Unique agent ID for memory scoping (optional)',
          objective: 'What the agent should accomplish (required)',
          systemPrompt: 'Custom system prompt (required)',
          tools: 'Array of tools to enable (optional)',
          context: 'Additional context (optional)',
          workspacePath: 'Path to workspace for file tools (optional)',
          maxIterations: 'Max iterations (default 10)',
        },
      },
      '/analyze': {
        method: 'POST',
        price: '$0.05 USDC',
        description: 'DeFi security analysis (specialized)',
        params: {
          repoUrl: 'GitHub repository URL (required)',
          filePath: 'Specific file to focus on (optional)',
          focus: 'Analysis focus area (optional)',
          mode: 'smart (default) or fast',
        },
      },
      '/patch': {
        method: 'POST',
        price: '$0.10 USDC',
        description: 'AI-generated security patch + optional PR creation',
        params: {
          repoUrl: 'GitHub repository URL (required)',
          filePath: 'File to patch (required)',
          issueDescription: 'Issue to fix (required)',
          createPr: 'Create PR automatically (optional)',
        },
      },
    },
    tools: {
      available: ['memory_search', 'memory_store', 'web_search', 'web_fetch', 'file_read', 'file_list'],
    },
    memory: {
      totalMemories: memoryStats.totalMemories,
      categories: Object.keys(memoryStats.byCategory),
    },
    network: NETWORK,
    wallet: AGENT_WALLET_ADDRESS || '(not set)',
  });
});

app.post('/agent', handleAgentRequest);
app.post('/analyze', analyzeCode);
app.post('/patch', generatePatch);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`BlockHelix Agent Server v0.5.0 running on port ${PORT}`);
  console.log(`Features: General agent, Tool use, Semantic memory, Web research`);
  console.log(`Payment address: ${AGENT_WALLET_ADDRESS || '(not set)'}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`x402 protocol: v2`);
  console.log(`Endpoints:`);
  console.log(`  POST /agent    - $0.10 USDC - General-purpose agent`);
  console.log(`  POST /analyze  - $0.05 USDC - DeFi security analysis`);
  console.log(`  POST /patch    - $0.10 USDC - Patch generation + PR`);
  console.log(`  GET  /health   - free`);
});
