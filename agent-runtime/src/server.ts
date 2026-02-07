import express from 'express';
import cors from 'cors';
import { x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { RoutesConfig } from '@x402/core/server';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { x402HTTPResourceServer, ExpressAdapter } = require('@x402/express') as {
  x402HTTPResourceServer: new (server: any, routes: any) => any;
  ExpressAdapter: new (req: express.Request) => any;
};
import { handleRun } from './routes/run';
import {
  handleRegisterAgent,
  handleListAgentsAdmin,
  handleGetAgentsByOwner,
  handleGetAgentConfig,
  handleUpdateAgentConfig,
  handleDeployOpenClaw,
  handleStopOpenClaw,
} from './routes/admin';
import { handleTest } from './routes/test';
import { getAgentConfig, getAllHostedAgents, initDefaultAgents } from './services/agent-config';
import { replayFromChain, type ReplayStats } from './services/replay';

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;

let lastReplay: ReplayStats | null = null;

export function createApp(): express.Application {
  const app = express();
  app.use(cors({
    origin: ['https://www.blockhelix.tech', 'https://blockhelix.tech', 'http://localhost:3000'],
    credentials: true,
    exposedHeaders: ['payment-required', 'x-payment-response'],
  }));

  app.use((_req, res, next) => {
    const exposeHeaders = () => {
      if (!res.headersSent) {
        res.setHeader('Access-Control-Expose-Headers', 'payment-required, x-payment-response');
      }
    };

    const originalEnd = res.end.bind(res);
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalWriteHead = res.writeHead.bind(res);

    res.writeHead = function (statusCode: number, ...args: any[]) {
      exposeHeaders();
      return originalWriteHead(statusCode, ...args);
    };

    res.end = function (...args: any[]) {
      exposeHeaders();
      return originalEnd(...args);
    };

    res.send = function (body: any) {
      exposeHeaders();
      return originalSend(body);
    };

    res.json = function (body: any) {
      exposeHeaders();
      return originalJson(body);
    };

    next();
  });

  app.use(express.json({ limit: '1mb' }));

  initDefaultAgents();

  replayFromChain()
    .then((stats) => { lastReplay = stats; })
    .catch((err) => { console.error('[replay] Failed:', err); });

  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(NETWORK, new ExactSvmScheme());

  const AGENT_WALLET = process.env.AGENT_WALLET || process.env.DEFAULT_AGENT_WALLET || '97hcopf5v277jJhDD91DzXMwCJs5UR6659Lzdny14oYm';
  const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
  const NATIVE_SOL = 'So11111111111111111111111111111111111111112';
  const staticRoutes: RoutesConfig = {
    'POST /v1/agent/*/run': {
      accepts: [
        {
          scheme: 'exact',
          price: { asset: USDC_DEVNET, amount: '50000' } as any,
          network: NETWORK,
          payTo: AGENT_WALLET,
        },
        {
          scheme: 'exact',
          price: { asset: NATIVE_SOL, amount: '300000' } as any,
          network: NETWORK,
          payTo: AGENT_WALLET,
        },
      ],
      description: 'Run BlockHelix agent',
      mimeType: 'application/json',
    },
  };

  console.log('[x402] Configured payment route: POST /v1/agent/*/run, payTo:', AGENT_WALLET);

  // Custom settle-first middleware: settle payment BEFORE running handler
  // so the tx blockhash doesn't expire during slow LLM calls
  const httpServer = new x402HTTPResourceServer(resourceServer, staticRoutes);
  let initPromise: Promise<void> | null = httpServer.initialize();

  app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adapter = new ExpressAdapter(req);
    const context = {
      adapter,
      path: req.path,
      method: req.method,
      paymentHeader: adapter.getHeader('payment-signature') || adapter.getHeader('x-payment'),
    };

    if (!(httpServer as any).requiresPayment(context)) {
      return next();
    }

    if (initPromise) {
      await initPromise;
      initPromise = null;
    }

    console.log(`[x402] Payment check: ${req.method} ${req.path}, has payment: ${!!context.paymentHeader}`);

    const result = await (httpServer as any).processHTTPRequest(context);

    switch (result.type) {
      case 'no-payment-required':
        return next();

      case 'payment-error': {
        const { response } = result;
        console.log(`[x402] Payment error: ${response.status}`);
        res.status(response.status);
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
        res.json(response.body || {});
        return;
      }

      case 'payment-verified': {
        console.log('[x402] Payment verified, settling immediately...');
        try {
          const settleResult = await (httpServer as any).processSettlement(
            result.paymentPayload,
            result.paymentRequirements,
          );
          if (!settleResult.success) {
            console.error('[x402] Settlement failed:', settleResult.errorReason);
            res.status(402).json({ error: 'Settlement failed', details: settleResult.errorReason });
            return;
          }
          console.log('[x402] Settlement success');
          Object.entries(settleResult.headers).forEach(([key, value]) => {
            res.setHeader(key, value as string);
          });
          req.headers['x-payment-response'] = settleResult.headers?.['x-payment-response'] || 'settled';
          return next();
        } catch (error) {
          console.error('[x402] Settlement error:', error);
          res.status(402).json({
            error: 'Settlement failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
          return;
        }
      }
    }
  });

  app.get('/health', (_req, res) => {
    const agents = getAllHostedAgents();
    res.json({
      status: 'ok',
      service: 'BlockHelix Agent Runtime',
      version: '0.2.1',
      network: NETWORK,
      replay: lastReplay ? {
        agentsSynced: lastReplay.agentsSynced,
        agentsSkipped: lastReplay.agentsSkipped,
        vaults: lastReplay.vaultStats,
        errors: lastReplay.errors.length,
      } : 'pending',
      hostedAgents: agents.map(a => ({
        agentId: a.agentId,
        name: a.name,
        price: `$${(a.priceUsdcMicro / 1_000_000).toFixed(2)} USDC`,
        active: a.isActive,
      })),
    });
  });

  app.post('/admin/replay', async (_req, res) => {
    try {
      const stats = await replayFromChain();
      lastReplay = stats;
      res.json({ message: 'Replay complete', stats });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Replay failed' });
    }
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

  app.post('/admin/openclaw/deploy', handleDeployOpenClaw);
  app.delete('/admin/openclaw/:agentId', handleStopOpenClaw);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
