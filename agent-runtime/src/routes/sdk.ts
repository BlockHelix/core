import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sdkAuth } from '../middleware/sdk-auth';
import { agentStorage } from '../services/storage';
import { eventIndexer } from '../services/event-indexer';
import { getAllHostedAgents } from '../services/agent-config';
import { pool } from '../services/db';
import {
  preflight as spendPreflight,
  settle as spendSettle,
  fail as spendFail,
  getApproval,
  resolveApproval,
  listPendingApprovals,
  listSpends,
  getBudget,
  setTaskStatus,
  BudgetError,
} from '../services/spend-ledger';

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

// ------------------------------------------------------------------
// Skills — install/list/remove skills at runtime
// ------------------------------------------------------------------

router.get('/skills', async (req: Request, res: Response) => {
  const agent = req.agent!;
  const prefix = `skills/${agent.agentId}/`;
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: UPLOAD_BUCKET, Prefix: prefix, MaxKeys: 100 }));
    const skills = (list.Contents || [])
      .filter((o) => o.Key?.endsWith('/SKILL.md'))
      .map((o) => {
        const parts = o.Key!.split('/');
        return { name: parts[parts.length - 2], key: o.Key!, size: o.Size || 0 };
      });
    res.json({ skills });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'list failed' });
  }
});

router.post('/skills/install', express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
  const agent = req.agent!;
  const { name, content } = req.body || {};
  if (!name || typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name)) {
    res.status(400).json({ error: 'name required (lowercase alphanumeric + dashes)' });
    return;
  }
  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'content (markdown) required' });
    return;
  }
  if (content.length > 50_000) {
    res.status(400).json({ error: 'skill too large (max 50KB)' });
    return;
  }
  const key = `skills/${agent.agentId}/${name}/SKILL.md`;
  await s3.send(new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: Buffer.from(content, 'utf-8'),
    ContentType: 'text/markdown',
  }));

  // Also write to the running container if it has an IP
  if (agent.isContainerized && agent.containerIp) {
    try {
      await fetch(`http://${agent.containerIp}:3001/v1/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: `A new skill "${name}" has been installed. Write the following content to $WORKSPACE/skills/${name}/SKILL.md:\n\n${content.slice(0, 10_000)}`,
          stream: false,
        }),
      });
    } catch {
      // Container might be down — skill is in S3 for next boot
    }
  }

  res.json({ ok: true, name, key });
});

router.get('/skills/:name', async (req: Request, res: Response) => {
  const agent = req.agent!;
  const name = req.params.name;
  const key = `skills/${agent.agentId}/${name}/SKILL.md`;
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: UPLOAD_BUCKET, Key: key }));
    const text = await obj.Body?.transformToString('utf-8') || '';
    res.setHeader('Content-Type', 'text/markdown');
    res.send(text);
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: 'skill not found' });
    } else {
      res.status(500).json({ error: err?.message || 'fetch failed' });
    }
  }
});

router.delete('/skills/:name', async (req: Request, res: Response) => {
  const agent = req.agent!;
  const name = req.params.name;
  const key = `skills/${agent.agentId}/${name}/SKILL.md`;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: UPLOAD_BUCKET, Key: key }));
    res.json({ ok: true, deleted: name });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'delete failed' });
  }
});

// ------------------------------------------------------------------
// Sub-agents — spawn focused workers on the same container
// ------------------------------------------------------------------

router.post('/subagent/run', express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
  const agent = req.agent!;
  const { task, context, timeout } = req.body || {};

  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'task (string) required' });
    return;
  }

  if (!agent.isContainerized || !agent.containerIp) {
    res.status(400).json({ error: 'agent has no running container' });
    return;
  }

  const sessionId = `sub-${crypto.randomUUID().slice(0, 8)}`;
  const timeoutMs = Math.min(Number(timeout) || 120_000, 300_000);

  const systemPrompt = [
    `You are a sub-agent worker spawned by ${agent.name}. Your ONLY job is to complete the task below and return the result. Do not engage in conversation. Do not ask follow-up questions. Just do the work and output the result.`,
    context ? `\nContext from parent agent:\n${typeof context === 'string' ? context : JSON.stringify(context)}` : '',
    `\nTask:\n${task}`,
    '\nWhen done, output ONLY the result. No preamble, no "here is the result", just the content.',
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(`http://${agent.containerIp}:3001/v1/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: systemPrompt,
        sessionId,
        stream: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => 'unknown');
      res.status(502).json({ error: `container returned ${upstream.status}: ${err}` });
      return;
    }

    // Collect the full response from the NDJSON stream
    const reader = upstream.body?.getReader();
    if (!reader) {
      res.status(502).json({ error: 'no stream body' });
      return;
    }

    const decoder = new TextDecoder();
    let buf = '';
    let result = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'delta') result += parsed.text || '';
          else if (parsed.type === 'done' && parsed.text) result = parsed.text;
          else if (parsed.type === 'error') {
            res.status(500).json({ error: parsed.error || 'sub-agent error', sessionId });
            return;
          }
        } catch { /* skip */ }
      }
    }

    res.json({ result: result.trim(), sessionId });
  } catch (err: any) {
    clearTimeout(timer);
    const msg = err?.message || 'sub-agent failed';
    res.status(msg.includes('abort') ? 408 : 500).json({ error: msg, sessionId });
  }
});

// ------------------------------------------------------------------
// Knowledge — persistent wiki backup/restore to S3
// ------------------------------------------------------------------

router.post('/knowledge/backup', express.raw({ type: '*/*', limit: '20mb' }), async (req: Request, res: Response) => {
  const agent = req.agent!;
  const key = `knowledge/${agent.agentId}/knowledge.tar.gz`;
  await s3.send(new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: req.body,
    ContentType: 'application/gzip',
  }));
  res.json({ ok: true, key, size: req.body?.length || 0 });
});

router.post('/knowledge/restore', async (req: Request, res: Response) => {
  const agent = req.agent!;
  const key = `knowledge/${agent.agentId}/knowledge.tar.gz`;
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: UPLOAD_BUCKET, Key: key }));
    const stream = obj.Body as any;
    res.setHeader('Content-Type', 'application/gzip');
    if (obj.ContentLength) res.setHeader('Content-Length', obj.ContentLength.toString());
    stream.pipe(res);
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ error: 'no backup found' });
    } else {
      console.error('[sdk] knowledge restore error:', err?.message);
      res.status(500).json({ error: 'restore failed' });
    }
  }
});

// ------------------------------------------------------------------
// Publish — deploy static sites from container public/ to S3
// ------------------------------------------------------------------

router.post('/publish', express.json({ limit: '10mb' }), async (req: Request, res: Response) => {
  const agent = req.agent!;
  const agentId = agent.agentId;
  const files: Array<{ path: string; content?: string; contentBase64?: string; contentType?: string }> = req.body?.files;

  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'files array required' });
    return;
  }

  if (files.length > 50) {
    res.status(400).json({ error: 'max 50 files per publish' });
    return;
  }

  const uploaded: string[] = [];
  for (const f of files) {
    if (!f.path || typeof f.path !== 'string') continue;
    // Sanitize path — no ../ or absolute paths
    const clean = f.path.replace(/^\/+/, '').replace(/\.\.\//g, '');
    if (!clean) continue;

    const key = `sites/${agentId}/${clean}`;
    const body = f.contentBase64
      ? Buffer.from(f.contentBase64, 'base64')
      : Buffer.from(f.content || '', 'utf-8');

    const ct = f.contentType || guessMime(clean);

    await s3.send(new PutObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: key,
      Body: body,
      ContentType: ct,
      CacheControl: 'public, max-age=60',
    }));
    uploaded.push(clean);
  }

  const baseUrl = `${req.protocol}://${req.get('host')}/sites/${agentId}`;
  const indexUrl = uploaded.includes('index.html') ? `${baseUrl}/index.html` : baseUrl;

  res.json({
    url: indexUrl,
    baseUrl,
    files: uploaded,
    count: uploaded.length,
  });
});

function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: 'text/html', css: 'text/css', js: 'application/javascript',
    json: 'application/json', svg: 'image/svg+xml', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    ico: 'image/x-icon', txt: 'text/plain', md: 'text/markdown',
    woff2: 'font/woff2', woff: 'font/woff',
  };
  return map[ext || ''] || 'application/octet-stream';
}

// ------------------------------------------------------------------
// Spend / budget / approval endpoints
// ------------------------------------------------------------------

function handleBudgetError(res: Response, err: unknown): void {
  if (err instanceof BudgetError) {
    const status = err.code === 'AGENT_NOT_FOUND' ? 404 : 402;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[sdk] Unexpected error:', err);
  res.status(500).json({ error: 'Internal error' });
}

router.get('/budget', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  try {
    const budget = await getBudget(agent.vault);
    if (!budget) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json(budget);
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/spend/preflight', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  const { amount_micro, reason, recipient } = req.body || {};
  if (typeof amount_micro !== 'number' || !reason) {
    res.status(400).json({ error: 'amount_micro and reason required' });
    return;
  }
  try {
    const result = await spendPreflight(agent.vault, amount_micro, String(reason), recipient);
    res.json(result);
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/spend/settle', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  const { reservation_id, tx_signature, recipient, reason } = req.body || {};
  if (typeof reservation_id !== 'number') {
    res.status(400).json({ error: 'reservation_id required' });
    return;
  }
  try {
    await spendSettle(agent.vault, reservation_id, tx_signature, recipient, reason);
    res.json({ ok: true });
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/spend/fail', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  const { reservation_id, reason } = req.body || {};
  if (typeof reservation_id !== 'number') {
    res.status(400).json({ error: 'reservation_id required' });
    return;
  }
  try {
    await spendFail(agent.vault, reservation_id, String(reason || 'unknown'));
    res.json({ ok: true });
  } catch (err) { handleBudgetError(res, err); }
});

router.get('/spends', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.json({ spends: [] }); return; }
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  try {
    const spends = await listSpends(agent.vault, limit);
    res.json({ spends });
  } catch (err) { handleBudgetError(res, err); }
});

router.get('/approvals', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.json({ approvals: [] }); return; }
  try {
    const approvals = await listPendingApprovals(agent.vault);
    res.json({ approvals });
  } catch (err) { handleBudgetError(res, err); }
});

router.get('/approvals/:id', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const approval = await getApproval(agent.vault, id);
    if (!approval) { res.status(404).json({ error: 'Approval not found' }); return; }
    res.json(approval);
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/approvals/:id/resolve', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const { decision, operator_username } = req.body || {};
  if (decision !== 'approved' && decision !== 'rejected') {
    res.status(400).json({ error: 'decision must be approved or rejected' });
    return;
  }
  try {
    const existing = await getApproval(agent.vault, id);
    if (!existing) { res.status(404).json({ error: 'Approval not found' }); return; }
    const result = await resolveApproval(id, decision, String(operator_username || 'unknown'));
    res.json(result);
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/task/complete', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  try {
    await setTaskStatus(agent.vault, 'completed');
    res.json({ ok: true, status: 'completed' });
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/task/pause', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  try {
    await setTaskStatus(agent.vault, 'paused');
    res.json({ ok: true, status: 'paused' });
  } catch (err) { handleBudgetError(res, err); }
});

router.post('/task/resume', async (req: Request, res: Response) => {
  const agent = req.agent!;
  if (!agent.vault) { res.status(400).json({ error: 'Agent has no vault' }); return; }
  try {
    await setTaskStatus(agent.vault, 'running');
    res.json({ ok: true, status: 'running' });
  } catch (err) { handleBudgetError(res, err); }
});

export default router;
