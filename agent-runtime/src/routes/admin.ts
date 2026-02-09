import { Request, Response } from 'express';
import { Keypair } from '@solana/web3.js';
import { registerHostedAgent, getAllHostedAgents, getHostedAgent } from '../services/agent-config';
import { agentStorage } from '../services/storage';
import { verifyWalletSignature, parseSignMessage, isMessageRecent } from '../services/wallet-verify';
import { containerManager } from '../services/container-manager';
import { eventIndexer } from '../services/event-indexer';
import { encrypt } from '../services/crypto';
import type { AgentConfig } from '../types';

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
  const { agentId, name, systemPrompt, priceUsdcMicro, model, operator, vault, registry, apiKey, ownerWallet, jobSignerPubkey, walletSecretKey: bodySecretKey, telegramBotToken } = req.body;

  if (!agentId || !name || !systemPrompt || !apiKey) {
    res.status(400).json({
      error: 'Missing required fields: agentId, name, systemPrompt, apiKey',
    });
    return;
  }

  const existing = getHostedAgent(agentId);
  if (existing) {
    res.status(409).json({ error: `Agent already exists: ${agentId}` });
    return;
  }

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
    const container = await containerManager.deployAgent({
      agentId,
      systemPrompt,
      anthropicApiKey: apiKey,
      model,
      telegramBotToken,
    });

    const fullConfig: AgentConfig = {
      agentId,
      name,
      systemPrompt,
      priceUsdcMicro: priceUsdcMicro ?? 100_000,
      model: model || 'claude-sonnet-4-20250514',
      operator: operator || '',
      vault: vault || '',
      registry: registry || '',
      isActive: true,
      apiKey,
      isContainerized: true,
      containerIp: container.privateIp,
      agentWallet,
      walletSecretKey,
    };

    await agentStorage.create(fullConfig, ownerWallet || operator || '');
    eventIndexer.refreshMappings();

    res.status(201).json({
      message: 'OpenClaw agent deployed',
      agent: {
        agentId: fullConfig.agentId,
        name: fullConfig.name,
        priceUsdcMicro: fullConfig.priceUsdcMicro,
        model: fullConfig.model,
        isActive: fullConfig.isActive,
        isContainerized: true,
        containerIp: container.privateIp,
      },
    });
  } catch (err) {
    console.error('[openclaw] Deploy failed:', err);
    const message = err instanceof Error ? err.message : 'Deploy failed';
    res.status(500).json({ error: message });
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
