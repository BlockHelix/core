import { Request, Response } from 'express';
import { registerHostedAgent, getAllHostedAgents, getHostedAgent } from '../services/agent-config';
import { agentStorage } from '../services/storage';
import { verifyWalletSignature, parseSignMessage, isMessageRecent } from '../services/wallet-verify';
import type { AgentConfig } from '../types';

export function handleRegisterAgent(req: Request, res: Response): void {
  const config = req.body as Partial<AgentConfig> & { ownerWallet?: string };

  if (!config.agentId || !config.name || !config.systemPrompt || !config.agentWallet || !config.apiKey) {
    res.status(400).json({
      error: 'Missing required fields: agentId, name, systemPrompt, agentWallet, apiKey',
    });
    return;
  }

  const existing = getHostedAgent(config.agentId);
  if (existing) {
    res.status(409).json({ error: `Agent already exists: ${config.agentId}` });
    return;
  }

  const fullConfig: AgentConfig = {
    agentId: config.agentId,
    name: config.name,
    systemPrompt: config.systemPrompt,
    priceUsdcMicro: config.priceUsdcMicro ?? 100_000,
    model: config.model || 'claude-sonnet-4-20250514',
    agentWallet: config.agentWallet,
    vault: config.vault || '',
    registry: config.registry || '',
    isActive: config.isActive ?? true,
    apiKey: config.apiKey,
  };

  registerHostedAgent(fullConfig, config.ownerWallet || config.agentWallet);

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
      agentWallet: a.agentWallet,
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
      agentWallet: a.agentWallet,
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
      agentWallet: agent.agentWallet,
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
    agentWallet: agent.agentWallet,
    vault: agent.vault,
    registry: agent.registry,
    isActive: agent.isActive,
    ownerWallet: agent.ownerWallet,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
}

export function handleUpdateAgentConfig(req: Request, res: Response): void {
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

  const updated = agentStorage.update(agentId, allowedUpdates);
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
