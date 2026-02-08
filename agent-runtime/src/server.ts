import express from 'express';
import cors from 'cors';
import { x402ResourceServer, paymentMiddleware } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import type { RoutesConfig } from '@x402/core/server';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { handleRun } from './routes/run';
import {
  handleRegisterAgent,
  handleListAgentsAdmin,
  handleGetAgentsByOwner,
  handleGetAgentConfig,
  handleUpdateAgentConfig,
  handleDeployOpenClaw,
  handleStopOpenClaw,
  handleGenerateKeypair,
} from './routes/admin';
import { handleTest } from './routes/test';
import { getAgentConfig, getAllHostedAgents, initDefaultAgents } from './services/agent-config';
import { replayFromChain, subscribeToFactory, type ReplayStats } from './services/replay';
import { agentStorage } from './services/storage';
import { initKmsSigner, getKmsPublicKey, isKmsEnabled } from './services/kms-signer';
import { EmbeddedFacilitatorClient } from './services/embedded-facilitator';

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL;
const USE_EMBEDDED_FACILITATOR = process.env.USE_EMBEDDED_FACILITATOR !== 'false';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;

let lastReplay: ReplayStats | null = null;

export function createApp(): express.Application {
  const app = express();
  app.set('trust proxy', true);
  app.use(cors({
    origin: '*',
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

  agentStorage.init()
    .then(() => initKmsSigner())
    .then(() => replayFromChain())
    .then((stats) => {
      lastReplay = stats;
      subscribeToFactory();
    })
    .catch((err) => { console.error('[startup] Failed:', err); });

  const facilitatorClient = USE_EMBEDDED_FACILITATOR
    ? new EmbeddedFacilitatorClient()
    : new HTTPFacilitatorClient({ url: FACILITATOR_URL || 'https://x402.org/facilitator' });
  console.log(`[x402] Using ${USE_EMBEDDED_FACILITATOR ? 'embedded' : 'HTTP'} facilitator`);
  const resourceServer = new x402ResourceServer(facilitatorClient as any)
    .register(NETWORK, new ExactSvmScheme());

  const AGENT_WALLET = process.env.AGENT_WALLET || '97hcopf5v277jJhDD91DzXMwCJs5UR6659Lzdny14oYm';
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

  // Sanitize payment headers before x402 middleware - invalid values crash it
  app.use((req, _res, next) => {
    for (const header of ['payment-signature', 'x-payment']) {
      const val = req.headers[header];
      if (val && typeof val === 'string') {
        try {
          JSON.parse(atob(val));
        } catch {
          try {
            JSON.parse(val);
          } catch {
            console.warn(`[x402] Stripping invalid ${header} header: ${val.substring(0, 30)}`);
            delete req.headers[header];
          }
        }
      }
    }
    next();
  });

  app.use(paymentMiddleware(staticRoutes, resourceServer));

  app.get('/health', (_req, res) => {
    const agents = getAllHostedAgents();
    const kmsEnabled = isKmsEnabled();
    const kmsPubkey = getKmsPublicKey();
    res.json({
      status: 'ok',
      service: 'BlockHelix Agent Runtime',
      version: '0.3.0',
      network: NETWORK,
      facilitator: USE_EMBEDDED_FACILITATOR ? 'embedded' : 'http',
      kms: kmsEnabled ? { enabled: true, publicKey: kmsPubkey?.toBase58() } : { enabled: false },
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

  app.post('/admin/keypair', handleGenerateKeypair);
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
