import { Request, Response, NextFunction } from 'express';
import { Keypair } from '@solana/web3.js';
import { registerHostedAgent, getAllHostedAgents, getHostedAgent } from '../services/agent-config';
import { agentStorage } from '../services/storage';
import { verifyWalletSignature, parseSignMessage, isMessageRecent } from '../services/wallet-verify';
import { containerManager } from '../services/container-manager';
import { eventIndexer } from '../services/event-indexer';
import { encrypt } from '../services/crypto';
import { runAgent } from '../services/llm';
import {
  getBudget as getAgentBudget,
  listSpends as listAgentSpends,
  listPendingApprovals as listAgentPendingApprovals,
  setTaskStatus as setAgentTaskStatus,
} from '../services/spend-ledger';
import { getVaultState } from '../services/mood-state';
import type { AgentConfig } from '../types';

export function requireWalletAuth(req: Request, res: Response, next: NextFunction): void {
  const { wallet, signature, signedAt } = req.body;

  if (!wallet || !signature || !signedAt) {
    res.status(401).json({ error: 'Missing auth fields: wallet, signature, signedAt' });
    return;
  }

  const timestamp = typeof signedAt === 'number' ? signedAt : parseInt(signedAt, 10);
  if (!isMessageRecent(timestamp, 120_000)) {
    res.status(401).json({ error: 'Signature expired' });
    return;
  }

  const message = `BlockHelix-admin:${timestamp}`;
  const isValid = verifyWalletSignature({ message, signature, publicKey: wallet });
  if (!isValid) {
    res.status(401).json({ error: 'Invalid wallet signature' });
    return;
  }

  next();
}

const pendingKeypairs = new Map<string, { keypair: Keypair; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingKeypairs) {
    if (now - value.createdAt > 10 * 60 * 1000) {
      pendingKeypairs.delete(key);
    }
  }
}, 60 * 1000);

export function handleGenerateKeypair(req: Request, res: Response): void {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();

  pendingKeypairs.set(publicKey, { keypair, createdAt: Date.now() });

  res.json({ publicKey });
}

export function getPendingKeypair(publicKey: string): Keypair | null {
  const entry = pendingKeypairs.get(publicKey);
  if (!entry) return null;
  pendingKeypairs.delete(publicKey);
  return entry.keypair;
}

export async function handleRegisterAgent(req: Request, res: Response): Promise<void> {
  const config = req.body as Partial<AgentConfig> & { ownerWallet?: string; jobSignerPubkey?: string };

  if (!config.agentId || !config.name || !config.systemPrompt || !config.operator || !config.apiKey) {
    res.status(400).json({
      error: 'Missing required fields: agentId, name, systemPrompt, operator, apiKey',
    });
    return;
  }

  const existing = getHostedAgent(config.agentId);
  if (existing) {
    res.status(409).json({ error: `Agent already exists: ${config.agentId}` });
    return;
  }

  let agentWallet = config.agentWallet;
  let walletSecretKey = config.walletSecretKey;

  if (config.jobSignerPubkey && !walletSecretKey) {
    const pendingKeypair = getPendingKeypair(config.jobSignerPubkey);
    if (pendingKeypair) {
      agentWallet = pendingKeypair.publicKey.toBase58();
      walletSecretKey = JSON.stringify(Array.from(pendingKeypair.secretKey));
    }
  }

  const fullConfig: AgentConfig = {
    agentId: config.agentId,
    name: config.name,
    systemPrompt: config.systemPrompt,
    priceUsdcMicro: config.priceUsdcMicro ?? 100_000,
    model: config.model || 'claude-sonnet-4-20250514',
    operator: config.operator,
    vault: config.vault || '',
    registry: config.registry || '',
    isActive: config.isActive ?? true,
    apiKey: config.apiKey,
    agentWallet,
    walletSecretKey,
  };

  await registerHostedAgent(fullConfig, config.ownerWallet || config.operator);
  eventIndexer.refreshMappings();

  res.status(201).json({
    message: 'Agent registered',
    agent: {
      agentId: fullConfig.agentId,
      name: fullConfig.name,
      priceUsdcMicro: fullConfig.priceUsdcMicro,
      model: fullConfig.model,
      isActive: fullConfig.isActive,
    },
  });
}

export function handleListAgentsAdmin(req: Request, res: Response): void {
  const agents = getAllHostedAgents();
  res.json({
    agents: agents.map(a => ({
      agentId: a.agentId,
      name: a.name,
      systemPrompt: a.systemPrompt.substring(0, 200) + (a.systemPrompt.length > 200 ? '...' : ''),
      priceUsdcMicro: a.priceUsdcMicro,
      model: a.model,
      operator: a.operator,
      vault: a.vault,
      registry: a.registry,
      isActive: a.isActive,
    })),
  });
}

export function handleGetAgentsByOwner(req: Request, res: Response): void {
  const { wallet } = req.query;

  if (!wallet || typeof wallet !== 'string') {
    res.status(400).json({ error: 'Missing wallet parameter' });
    return;
  }

  const agents = agentStorage.getByOwner(wallet);
  res.json({
    agents: agents.map(a => ({
      agentId: a.agentId,
      name: a.name,
      priceUsdcMicro: a.priceUsdcMicro,
      model: a.model,
      operator: a.operator,
      vault: a.vault,
      isActive: a.isActive,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
}

export function handleGetAgentConfig(req: Request, res: Response): void {
  const { agentId } = req.params;
  const { wallet } = req.query;

  const agent = agentStorage.get(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const isOwner = wallet && agent.ownerWallet === wallet;

  if (!isOwner) {
    res.json({
      agentId: agent.agentId,
      name: agent.name,
      priceUsdcMicro: agent.priceUsdcMicro,
      model: agent.model,
      operator: agent.operator,
      vault: agent.vault,
      isActive: agent.isActive,
    });
    return;
  }

  res.json({
    agentId: agent.agentId,
    name: agent.name,
    systemPrompt: agent.systemPrompt,
    priceUsdcMicro: agent.priceUsdcMicro,
    model: agent.model,
    operator: agent.operator,
    vault: agent.vault,
    registry: agent.registry,
    isActive: agent.isActive,
    ownerWallet: agent.ownerWallet,
    agentWallet: agent.agentWallet,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
}

export async function handleUpdateAgentConfig(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const { message, signature, wallet, updates } = req.body;

  if (!message || !signature || !wallet) {
    res.status(400).json({ error: 'Missing required fields: message, signature, wallet' });
    return;
  }

  const agent = agentStorage.get(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.ownerWallet !== wallet) {
    res.status(403).json({ error: 'Not authorized: wallet does not own this agent' });
    return;
  }

  const isValid = verifyWalletSignature({ message, signature, publicKey: wallet });
  if (!isValid) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const parsedMessage = parseSignMessage(message);
  if (!parsedMessage || parsedMessage.agentId !== agentId) {
    res.status(400).json({ error: 'Invalid message format' });
    return;
  }

  if (!isMessageRecent(parsedMessage.timestamp)) {
    res.status(400).json({ error: 'Message expired' });
    return;
  }

  const allowedUpdates: Partial<AgentConfig> = {};
  if (updates.systemPrompt !== undefined) allowedUpdates.systemPrompt = updates.systemPrompt;
  if (updates.apiKey !== undefined) allowedUpdates.apiKey = updates.apiKey;
  if (updates.priceUsdcMicro !== undefined) allowedUpdates.priceUsdcMicro = updates.priceUsdcMicro;
  if (updates.model !== undefined) allowedUpdates.model = updates.model;
  if (updates.isActive !== undefined) allowedUpdates.isActive = updates.isActive;

  const updated = await agentStorage.update(agentId, allowedUpdates);
  if (!updated) {
    res.status(500).json({ error: 'Failed to update agent' });
    return;
  }

  res.json({
    message: 'Agent updated',
    agent: {
      agentId: updated.agentId,
      name: updated.name,
      priceUsdcMicro: updated.priceUsdcMicro,
      model: updated.model,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
  });
}

export async function handleDeployOpenClaw(req: Request, res: Response): Promise<void> {
  const { agentId, name, systemPrompt, priceUsdcMicro, model, operator, vault, registry, apiKey, ownerWallet, jobSignerPubkey, walletSecretKey: bodySecretKey, telegramBotToken, operatorTelegram, braveApiKey, colosseumApiKey, kimiApiKey, veoApiKey, runwayApiKey, heartbeat, taskDescription, budgetUsdcMicro, approvalThresholdUsdcMicro, birthMd, purposeMd, memoryMd, archetype } = req.body;

  if (!vault || !name || !systemPrompt || !apiKey) {
    res.status(400).json({
      error: 'Missing required fields: vault, name, systemPrompt, apiKey',
    });
    return;
  }

  const budgetMicro = typeof budgetUsdcMicro === 'number' ? budgetUsdcMicro : 0;
  const thresholdMicro = typeof approvalThresholdUsdcMicro === 'number' ? approvalThresholdUsdcMicro : 5_000_000;

  let agentWallet: string | undefined;
  let walletSecretKey: string | undefined = bodySecretKey;

  if (jobSignerPubkey && !walletSecretKey) {
    const pendingKeypair = getPendingKeypair(jobSignerPubkey);
    if (pendingKeypair) {
      agentWallet = pendingKeypair.publicKey.toBase58();
      walletSecretKey = JSON.stringify(Array.from(pendingKeypair.secretKey));
    }
  } else if (jobSignerPubkey && walletSecretKey) {
    agentWallet = jobSignerPubkey;
  }

  try {
    const fullConfig: AgentConfig = {
      agentId: agentId || '',
      name,
      systemPrompt,
      priceUsdcMicro: priceUsdcMicro ?? 0,
      model: model || 'claude-sonnet-4-20250514',
      operator: operator || '',
      vault,
      registry: registry || '',
      isActive: false,
      apiKey,
      isContainerized: true,
      agentWallet,
      walletSecretKey,
      deployStatus: 'deploying',
      taskDescription: taskDescription || systemPrompt,
      budgetTotalMicro: budgetMicro,
      budgetSpentMicro: 0,
      budgetReservedMicro: 0,
      approvalThresholdMicro: thresholdMicro,
      taskStatus: 'running',
      operatorTelegram: operatorTelegram || undefined,
    };

    const stored = await agentStorage.create(fullConfig, ownerWallet || operator || '');
    // Persist the new fields — create() doesn't know about them by default, so update after
    await agentStorage.update(vault, {
      taskDescription: fullConfig.taskDescription,
      budgetTotalMicro: budgetMicro,
      approvalThresholdMicro: thresholdMicro,
      taskStatus: 'running',
      operatorTelegram: fullConfig.operatorTelegram,
      birthMd: birthMd || undefined,
      purposeMd: purposeMd || undefined,
      memoryMd: memoryMd || undefined,
      archetype: archetype || undefined,
    });
    eventIndexer.refreshMappings();

    res.status(201).json({
      message: 'OpenClaw deploy started',
      agent: {
        agentId: fullConfig.agentId,
        vault: fullConfig.vault,
        name: fullConfig.name,
        priceUsdcMicro: fullConfig.priceUsdcMicro,
        model: fullConfig.model,
        isActive: false,
        isContainerized: true,
        deployStatus: 'deploying',
      },
    });

    const runtimeUrl = process.env.RUNTIME_URL || `https://${req.headers.host}`;

    containerManager.deployAgent({
      agentId: agentId || vault,
      agentName: name,
      systemPrompt,
      anthropicApiKey: apiKey,
      model,
      telegramBotToken,
      operatorTelegram,
      sdkKey: stored.sdkKey,
      runtimeUrl,
      braveApiKey: braveApiKey || process.env.BRAVE_API_KEY,
      colosseumApiKey,
      kimiApiKey,
      veoApiKey,
      runwayApiKey,
      taskDescription: fullConfig.taskDescription,
      budgetTotalMicro: budgetMicro,
      approvalThresholdMicro: thresholdMicro,
      birthMd: birthMd || undefined,
      purposeMd: purposeMd || undefined,
      memoryMd: memoryMd || undefined,
      archetype: archetype || undefined,
      heartbeat: heartbeat?.enabled ? {
        enabled: true,
        interval: heartbeat.interval,
        model: heartbeat.model,
        activeStart: heartbeat.activeStart,
        activeEnd: heartbeat.activeEnd,
        timezone: heartbeat.timezone,
      } : undefined,
      onProgress: (phase) => {
        agentStorage.update(vault, { deployPhase: phase }).catch(() => {});
      },
    }).then(async (container) => {
      await agentStorage.update(vault, {
        containerIp: container.privateIp,
        isActive: true,
        deployStatus: 'active',
        deployPhase: 'complete',
      });
      console.log(`[openclaw] Async deploy complete for ${vault}`);
    }).catch(async (err) => {
      console.error('[openclaw] Async deploy failed:', err);
      await agentStorage.update(vault, {
        deployStatus: 'failed',
        deployError: err instanceof Error ? err.message : 'Deploy failed',
      }).catch(() => {});
    });

  } catch (err) {
    console.error('[openclaw] Deploy failed:', err);
    const message = err instanceof Error ? err.message : 'Deploy failed';
    res.status(500).json({ error: message });
  }
}

export async function handleDeployStatus(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const agent = await agentStorage.getAsync(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({
    deployStatus: agent.deployStatus || 'pending',
    deployPhase: agent.deployPhase || null,
    containerIp: agent.containerIp || null,
    error: agent.deployError || null,
  });
}

// Budget + spends + pending approvals snapshot for the owner dashboard.
// Read-only; identified by vault. (Wallet-auth variant TBD.)
export async function handleOpsSummary(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const agent = await agentStorage.getAsync(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const vault = agent.vault;
  try {
    const [budget, spends, approvals] = await Promise.all([
      getAgentBudget(vault),
      listAgentSpends(vault, 20),
      listAgentPendingApprovals(vault),
    ]);
    res.json({
      agent: {
        vault,
        name: agent.name,
        agentWallet: agent.agentWallet || null,
        operatorTelegram: agent.operatorTelegram || null,
        taskDescription: agent.taskDescription || null,
        taskStatus: agent.taskStatus || 'running',
      },
      budget,
      spends,
      pendingApprovals: approvals,
    });
  } catch (err) {
    console.error('[admin] ops-summary error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}

// Public life endpoint — returns identity + mood + recent activity for the public vault page
export async function handleLife(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const agent = await agentStorage.getAsync(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Vault not found' });
    return;
  }
  try {
    const [state, spends] = await Promise.all([
      getVaultState(agent.vault),
      listAgentSpends(agent.vault, 10),
    ]);
    res.json({
      vault: {
        id: agent.vault,
        name: agent.name,
        agentId: agent.agentId,
        agentWallet: agent.agentWallet || null,
        archetype: agent.archetype || null,
        operator: agent.operator || null,
        operatorTelegram: agent.operatorTelegram || null,
        taskStatus: agent.taskStatus || 'running',
      },
      identity: {
        birth: agent.birthMd || null,
        purpose: agent.purposeMd || agent.taskDescription || agent.systemPrompt || null,
        memory: agent.memoryMd || null,
      },
      state,
      recentActivity: spends.map((s) => ({
        id: s.id,
        amountMicro: s.amountMicro,
        recipient: s.recipient,
        reason: s.reason,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('[admin] life error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}

export async function handleTaskControl(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const { action } = req.body || {};
  if (!['pause', 'resume', 'complete'].includes(action)) {
    res.status(400).json({ error: 'action must be pause | resume | complete' });
    return;
  }
  const agent = await agentStorage.getAsync(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const statusMap: Record<string, 'paused' | 'running' | 'completed'> = {
    pause: 'paused',
    resume: 'running',
    complete: 'completed',
  };
  try {
    await setAgentTaskStatus(agent.vault, statusMap[action]);
    res.json({ ok: true, status: statusMap[action] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}

export async function handleStopOpenClaw(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;

  try {
    await containerManager.stopAgent(agentId);
    await agentStorage.update(agentId, { isActive: false });
    res.json({ message: `Agent ${agentId} stopped` });
  } catch (err) {
    console.error('[openclaw] Stop failed:', err);
    const message = err instanceof Error ? err.message : 'Stop failed';
    res.status(500).json({ error: message });
  }
}

export async function handleAdminTestAgent(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const { input } = req.body;

  if (!input || typeof input !== 'string') {
    res.status(400).json({ error: 'input is required' });
    return;
  }

  const agent = agentStorage.get(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (!agent.apiKey) {
    res.status(400).json({ error: 'Agent has no API key configured' });
    return;
  }

  try {
    const result = await runAgent({ agent, input });
    res.json({ output: result.output, model: result.model, tokens: result.inputTokens + result.outputTokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test failed';
    res.status(500).json({ error: message });
  }
}
