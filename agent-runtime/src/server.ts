import express from 'express';
import { paymentMiddleware } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { x402ResourceServer } from '@x402/express';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { RoutesConfig } from '@x402/core/server';
import { handleRun } from './routes/run';
import {
  handleRegisterAgent,
  handleListAgentsAdmin,
  handleGetAgentsByOwner,
  handleGetAgentConfig,
  handleUpdateAgentConfig,
} from './routes/admin';
import { handleTest } from './routes/test';
import { getAgentConfig, getAllHostedAgents, initDefaultAgents } from './services/agent-config';

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;

export function createApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  initDefaultAgents();

  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(NETWORK, new ExactSvmScheme());

  const dynamicRoutes: RoutesConfig = new Proxy({} as RoutesConfig, {
    get(_target, prop: string) {
      const match = prop.match(/^POST \/v1\/agent\/([^/]+)\/run$/);
      if (!match) return undefined;

      const agentId = match[1];
      const agent = getAllHostedAgents().find(a => a.agentId === agentId);
      if (!agent) return undefined;

      const priceFormatted = `$${(agent.priceUsdcMicro / 1_000_000).toFixed(2)}`;
      return {
        accepts: {
          scheme: 'exact',
          price: priceFormatted,
          network: NETWORK,
          payTo: agent.agentWallet,
        },
        description: `Run ${agent.name} agent`,
        mimeType: 'application/json',
      };
    },
    has(_target, prop: string) {
      const match = prop.match(/^POST \/v1\/agent\/([^/]+)\/run$/);
      if (!match) return false;
      const agentId = match[1];
      return getAllHostedAgents().some(a => a.agentId === agentId);
    },
    ownKeys() {
      return getAllHostedAgents().map(a => `POST /v1/agent/${a.agentId}/run`);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const match = String(prop).match(/^POST \/v1\/agent\/([^/]+)\/run$/);
      if (!match) return undefined;
      const agentId = match[1];
      if (!getAllHostedAgents().some(a => a.agentId === agentId)) return undefined;
      return { configurable: true, enumerable: true };
    },
  });

  app.use(paymentMiddleware(dynamicRoutes, resourceServer));

  app.get('/health', (_req, res) => {
    const agents = getAllHostedAgents();
    res.json({
      status: 'ok',
      service: 'BlockHelix Agent Runtime',
      version: '0.1.0',
      network: NETWORK,
      hostedAgents: agents.map(a => ({
        agentId: a.agentId,
        name: a.name,
        price: `$${(a.priceUsdcMicro / 1_000_000).toFixed(2)} USDC`,
        active: a.isActive,
      })),
    });
  });

  app.get('/v1/agents', (_req, res) => {
    const agents = getAllHostedAgents();
    res.json({
      agents: agents.map(a => ({
        agentId: a.agentId,
        name: a.name,
        priceUsdcMicro: a.priceUsdcMicro,
        model: a.model,
        isActive: a.isActive,
      })),
    });
  });

  app.get('/v1/agent/:agentId', async (req, res) => {
    const { agentId } = req.params;
    const agent = await getAgentConfig(agentId);
    if (!agent) {
      res.status(404).json({ error: `Agent not found: ${agentId}` });
      return;
    }
    res.json({
      agentId: agent.agentId,
      name: agent.name,
      priceUsdcMicro: agent.priceUsdcMicro,
      model: agent.model,
      isActive: agent.isActive,
      vault: agent.vault || null,
      registry: agent.registry || null,
    });
  });

  app.post('/v1/agent/:agentId/run', handleRun);

  app.post('/v1/test', handleTest);

  app.post('/admin/agents', handleRegisterAgent);
  app.get('/admin/agents', handleListAgentsAdmin);
  app.get('/admin/agents/by-owner', handleGetAgentsByOwner);
  app.get('/admin/agents/:agentId', handleGetAgentConfig);
  app.put('/admin/agents/:agentId', handleUpdateAgentConfig);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
