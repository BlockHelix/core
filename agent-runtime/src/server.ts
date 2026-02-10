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
  handleAdminTestAgent,
  requireWalletAuth,
} from './routes/admin';
import { handleTest } from './routes/test';
import { getAgentConfig, getAllHostedAgents, initDefaultAgents } from './services/agent-config';
import { replayFromChain, subscribeToFactory, type ReplayStats } from './services/replay';
import { eventIndexer } from './services/event-indexer';
import { agentStorage } from './services/storage';
import { checkDb } from './services/db';
import { initKmsSigner, getKmsPublicKey, isKmsEnabled } from './services/kms-signer';
import { EmbeddedFacilitatorClient } from './services/embedded-facilitator';

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL;
const USE_EMBEDDED_FACILITATOR = process.env.USE_EMBEDDED_FACILITATOR === 'true';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;

let lastReplay: ReplayStats | null = null;

function adminRateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits) {
      const filtered = timestamps.filter(t => t > cutoff);
      if (filtered.length === 0) hits.delete(ip);
      else hits.set(ip, filtered);
    }
  }, windowMs);

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method === 'GET' || req.method === 'OPTIONS') return next();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (hits.get(ip) || []).filter(t => t > cutoff);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }
    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

export function createApp(): express.Application {
  const app = express();
  app.set('trust proxy', true);

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Payment, x-payment, Payment-Signature, PAYMENT-SIGNATURE, payment-signature, payment-required, PAYMENT-REQUIRED, x-payment-response, PAYMENT-RESPONSE'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'payment-required, PAYMENT-REQUIRED, x-payment-response, PAYMENT-RESPONSE'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment', 'x-payment', 'Payment-Signature', 'PAYMENT-SIGNATURE'],
    exposedHeaders: ['payment-required', 'PAYMENT-REQUIRED', 'x-payment-response', 'PAYMENT-RESPONSE'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }));

  app.use(express.json({ limit: '1mb' }));

  agentStorage.init()
    .then(() => {
      initDefaultAgents();
      return initKmsSigner();
    })
    .then(() => replayFromChain())
    .then((stats) => {
      lastReplay = stats;
      subscribeToFactory();
      return eventIndexer.init();
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

  // Routes that don't need payment - MUST be before x402 middleware
  app.get('/health', async (_req, res) => {
    const agents = getAllHostedAgents();
    const kmsEnabled = isKmsEnabled();
    const kmsPubkey = getKmsPublicKey();
    const dbOk = await checkDb();
    res.json({
      status: 'ok',
      service: 'BlockHelix Agent Runtime',
      version: '0.4.0',
      network: NETWORK,
      facilitator: USE_EMBEDDED_FACILITATOR ? 'embedded' : 'http',
      database: dbOk ? 'connected' : 'disconnected',
      kms: kmsEnabled ? { enabled: true, publicKey: kmsPubkey?.toBase58() } : { enabled: false },
      replay: lastReplay ? {
        agentsSynced: lastReplay.agentsSynced,
        agentsSkipped: lastReplay.agentsSkipped,
        errors: lastReplay.errors.length,
      } : 'pending',
      indexer: eventIndexer.getStatus(),
      hostedAgents: agents.map(a => ({
        agentId: a.agentId,
        name: a.name,
        price: `$${(a.priceUsdcMicro / 1_000_000).toFixed(2)} USDC`,
        active: a.isActive,
      })),
    });
  });

  let agentsListCache: { data: any; ts: number } | null = null;

  app.get('/v1/agents', async (_req, res) => {
    if (agentsListCache && Date.now() - agentsListCache.ts < DETAIL_CACHE_TTL) {
      res.json(agentsListCache.data);
      return;
    }

    const agents = getAllHostedAgents();
    const vaults = agents.map(a => a.vault).filter(Boolean) as string[];
    const statsMap = await eventIndexer.getStatsForVaults(vaults);
    const data = {
      agents: agents.map(a => {
        const s = a.vault ? statsMap.get(a.vault) : undefined;
        return {
          agentId: a.agentId,
          name: a.name,
          operator: a.operator || null,
          vault: a.vault || null,
          registry: a.registry || null,
          priceUsdcMicro: a.priceUsdcMicro,
          model: a.model,
          isActive: a.isActive,
          stats: s ? {
            tvl: s.tvl, totalRevenue: s.totalRevenue, totalJobs: s.totalJobs,
            apiCalls: s.apiCalls, paused: s.paused, slashEvents: s.slashEvents,
            totalSlashed: s.totalSlashed, operatorBond: s.operatorBond, jobsRecorded: s.jobsRecorded,
          } : null,
        };
      }),
    };
    agentsListCache = { data, ts: Date.now() };
    res.json(data);
  });

  const agentDetailCache = new Map<string, { data: any; ts: number }>();
  const DETAIL_CACHE_TTL = 15_000;

  app.get('/v1/agent/:agentId', async (req, res) => {
    const { agentId } = req.params;

    const cached = agentDetailCache.get(agentId);
    if (cached && Date.now() - cached.ts < DETAIL_CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    const all = getAllHostedAgents();
    let agent = all.find(a => a.agentId === agentId || a.vault === agentId) || null;
    if (!agent) agent = await getAgentConfig(agentId);
    if (!agent) {
      res.status(404).json({ error: `Agent not found: ${agentId}` });
      return;
    }
    const s = agent.vault ? await eventIndexer.getStats(agent.vault, true) : await eventIndexer.getStatsByAgentId(agentId, true);
    const data = {
      agentId: agent.agentId,
      name: agent.name,
      operator: agent.operator || null,
      priceUsdcMicro: agent.priceUsdcMicro,
      model: agent.model,
      isActive: agent.isActive,
      vault: agent.vault || null,
      registry: agent.registry || null,
      stats: s ? {
        tvl: s.tvl, totalRevenue: s.totalRevenue, totalJobs: s.totalJobs,
        apiCalls: s.apiCalls, paused: s.paused, slashEvents: s.slashEvents,
        totalSlashed: s.totalSlashed, operatorBond: s.operatorBond, jobsRecorded: s.jobsRecorded,
      } : null,
      revenueHistory: s?.revenueByDay || [],
      recentJobs: s?.recentJobs || [],
    };
    agentDetailCache.set(agentId, { data, ts: Date.now() });
    res.json(data);
  });

  app.post('/v1/test', handleTest);

  const adminLimit = adminRateLimit(5, 60_000);

  app.post('/admin/keypair', adminLimit, handleGenerateKeypair);
  app.post('/admin/agents', adminLimit, requireWalletAuth, handleRegisterAgent);
  app.get('/admin/agents', handleListAgentsAdmin);
  app.get('/admin/agents/by-owner', handleGetAgentsByOwner);
  app.get('/admin/agents/:agentId', handleGetAgentConfig);
  app.put('/admin/agents/:agentId', handleUpdateAgentConfig);
  app.post('/admin/replay', adminLimit, async (_req, res) => {
    try {
      const stats = await replayFromChain();
      lastReplay = stats;
      eventIndexer.refreshMappings();
      res.json({ message: 'Replay complete', stats });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Replay failed' });
    }
  });
  app.post('/admin/openclaw/deploy', adminLimit, requireWalletAuth, handleDeployOpenClaw);
  app.delete('/admin/openclaw/:agentId', adminLimit, requireWalletAuth, handleStopOpenClaw);
  app.post('/admin/agents/:agentId/test', adminLimit, handleAdminTestAgent);

  // x402 payment middleware - only affects routes defined AFTER this
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

  app.use((_req, res, next) => {
    const origWriteHead = res.writeHead;
    (res as any).writeHead = function (this: any, statusCode: number, ...rest: any[]) {
      this.setHeader('Access-Control-Allow-Origin', '*');
      this.setHeader('Access-Control-Expose-Headers', 'payment-required, PAYMENT-REQUIRED, x-payment-response, PAYMENT-RESPONSE');
      return origWriteHead.call(this, statusCode, ...rest);
    };
    next();
  });

  app.use(paymentMiddleware(staticRoutes, resourceServer));

  app.post('/v1/agent/:agentId/run', handleRun);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
