import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sdkAuth } from '../middleware/sdk-auth';
import { agentStorage } from '../services/storage';
import { eventIndexer } from '../services/event-indexer';
import { getAllHostedAgents } from '../services/agent-config';
import { pool } from '../services/db';

const s3 = new S3Client({});
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET || 'blockhelix-dev-storage';

const router = Router();
router.use(sdkAuth);

const SOLSCAN_BASE = 'https://solscan.io/tx';
const SOLSCAN_SUFFIX = '?cluster=devnet';

router.get('/me', async (req: Request, res: Response) => {
  const agent = req.agent!;
  const stats = agent.vault ? await eventIndexer.getStats(agent.vault, true) : undefined;

  res.json({
    agentId: agent.agentId,
    name: agent.name,
    vault: agent.vault,
    operator: agent.operator,
    registry: agent.registry || null,
    model: agent.model,
    priceUsdcMicro: agent.priceUsdcMicro,
    isActive: agent.isActive,
    agentWallet: agent.agentWallet || null,
    stats: stats ? {
      tvl: stats.tvl,
      totalRevenue: stats.totalRevenue,
      totalJobs: stats.totalJobs,
      apiCalls: stats.apiCalls,
      operatorBond: stats.operatorBond,
      paused: stats.paused,
      slashEvents: stats.slashEvents,
      totalSlashed: stats.totalSlashed,
      jobsRecorded: stats.jobsRecorded,
    } : null,
    revenueHistory: stats?.revenueByDay || [],
  });
});

router.get('/agents', async (_req: Request, res: Response) => {
  const limit = Math.min(parseInt(_req.query.limit as string) || 50, 100);
  const offset = parseInt(_req.query.offset as string) || 0;
  const activeFilter = _req.query.active;

  let agents = getAllHostedAgents();
  if (activeFilter === 'true') agents = agents.filter(a => a.isActive);
  else if (activeFilter === 'false') agents = agents.filter(a => !a.isActive);
  agents = agents.filter(a => a.vault && a.name);

  const total = agents.length;
  const page = agents.slice(offset, offset + limit);
  const vaults = page.map(a => a.vault).filter(Boolean) as string[];
  const statsMap = await eventIndexer.getStatsForVaults(vaults);

  res.json({
    agents: page.map(a => {
      const s = a.vault ? statsMap.get(a.vault) : undefined;
      return {
        agentId: a.agentId,
        name: a.name,
        operator: a.operator || null,
        vault: a.vault || null,
        registry: a.registry || null,
        model: a.model,
        priceUsdcMicro: a.priceUsdcMicro,
        isActive: a.isActive,
        stats: s ? {
          tvl: s.tvl, totalRevenue: s.totalRevenue, totalJobs: s.totalJobs,
          apiCalls: s.apiCalls, operatorBond: s.operatorBond,
        } : null,
      };
    }),
    total,
    limit,
    offset,
  });
});

router.get('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const agent = agentStorage.get(id) || await agentStorage.getAsync(id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const stats = agent.vault ? await eventIndexer.getStats(agent.vault, true) : undefined;

  res.json({
    agentId: agent.agentId,
    name: agent.name,
    operator: agent.operator || null,
    vault: agent.vault || null,
    registry: agent.registry || null,
    model: agent.model,
    priceUsdcMicro: agent.priceUsdcMicro,
    isActive: agent.isActive,
    stats: stats ? {
      tvl: stats.tvl, totalRevenue: stats.totalRevenue, totalJobs: stats.totalJobs,
      apiCalls: stats.apiCalls, operatorBond: stats.operatorBond,
      paused: stats.paused, slashEvents: stats.slashEvents,
      totalSlashed: stats.totalSlashed, jobsRecorded: stats.jobsRecorded,
    } : null,
    revenueHistory: stats?.revenueByDay || [],
    recentJobs: stats?.recentJobs?.map(j => ({
      ...j,
      solscanUrl: `${SOLSCAN_BASE}/${j.txSignature}${SOLSCAN_SUFFIX}`,
    })) || [],
  });
});

router.get('/jobs', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault || !pool) {
    res.json({ jobs: [], total: 0 });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as string | undefined;

  let query = 'SELECT * FROM job_receipts WHERE vault = $1';
  const params: any[] = [agent.vault];
  let countQuery = 'SELECT COUNT(*) FROM job_receipts WHERE vault = $1';
  const countParams: any[] = [agent.vault];

  if (status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(status);
    countQuery += ` AND status = $${countParams.length + 1}`;
    countParams.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const [jobsResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, countParams),
  ]);

  res.json({
    jobs: jobsResult.rows.map((r: any) => ({
      jobId: Number(r.job_id),
      client: r.client,
      paymentAmount: Number(r.payment_amount),
      createdAt: Number(r.created_at),
      status: r.status,
      txSignature: r.tx_signature,
      solscanUrl: `${SOLSCAN_BASE}/${r.tx_signature}${SOLSCAN_SUFFIX}`,
    })),
    total: parseInt(countResult.rows[0].count),
    limit,
    offset,
  });
});

router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim().toLowerCase();
  if (!q) {
    res.status(400).json({ error: 'Missing search query ?q=' });
    return;
  }

  const agent = req.agent!;
  const allAgents = getAllHostedAgents();
  const matchedAgents = allAgents
    .filter(a => a.name.toLowerCase().includes(q) || a.vault?.toLowerCase().includes(q))
    .slice(0, 10)
    .map(a => ({
      agentId: a.agentId,
      name: a.name,
      vault: a.vault || null,
      operator: a.operator || null,
      isActive: a.isActive,
    }));

  let matchedJobs: any[] = [];
  if (agent.vault && pool) {
    const jobsResult = await pool.query(
      `SELECT * FROM job_receipts WHERE vault = $1
       AND (client ILIKE $2 OR tx_signature ILIKE $2 OR CAST(job_id AS TEXT) = $3)
       ORDER BY created_at DESC LIMIT 10`,
      [agent.vault, `%${q}%`, q]
    );
    matchedJobs = jobsResult.rows.map((r: any) => ({
      jobId: Number(r.job_id),
      client: r.client,
      paymentAmount: Number(r.payment_amount),
      status: r.status,
      txSignature: r.tx_signature,
      solscanUrl: `${SOLSCAN_BASE}/${r.tx_signature}${SOLSCAN_SUFFIX}`,
    }));
  }

  res.json({ query: q, agents: matchedAgents, jobs: matchedJobs });
});

router.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req: Request, res: Response) => {
  const agent = req.agent!;
  const filename = (req.query.filename as string) || 'file';
  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  const key = `uploads/${agent.vault || agent.agentId}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`;

  await s3.send(new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: req.body,
    ContentType: contentType,
    ContentDisposition: `inline; filename="${filename}"`,
  }));

  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
  }), { expiresIn: 7 * 24 * 3600 });

  const publicUrl = `https://${UPLOAD_BUCKET}.s3.amazonaws.com/${key}`;

  res.json({ url, publicUrl, key, filename, expiresIn: '7d' });
});

export default router;
