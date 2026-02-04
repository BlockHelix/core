import express from 'express';
import dotenv from 'dotenv';
import { paymentMiddleware } from '@x402/express';
import { routes, resourceServer } from './utils/x402';
import { analyzeCode } from './routes/analyze';
import { generatePatch } from './routes/patch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS || '';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet'
  ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
  : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

app.use(express.json({ limit: '10mb' }));

app.use(paymentMiddleware(routes, resourceServer));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    agent: 'DefiData Patch Agent',
    version: '0.2.0',
    x402: 'v2',
    endpoints: {
      '/analyze': { method: 'POST', price: '$0.05 USDC', description: 'DeFi code analysis' },
      '/patch': { method: 'POST', price: '$0.10 USDC', description: 'Patch generation + optional PR' },
    },
    network: NETWORK,
    wallet: AGENT_WALLET_ADDRESS || '(not set)',
  });
});

app.post('/analyze', analyzeCode);
app.post('/patch', generatePatch);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`DefiData Patch Agent running on port ${PORT}`);
  console.log(`Payment address: ${AGENT_WALLET_ADDRESS || '(not set)'}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`x402 protocol: v2`);
  console.log(`Endpoints:`);
  console.log(`  POST /analyze  - $0.05 USDC - DeFi code analysis`);
  console.log(`  POST /patch    - $0.10 USDC - Patch generation + PR`);
  console.log(`  GET  /health   - free`);
});
