import { Request, Response } from 'express';
import { registerHostedAgent, getAllHostedAgents, getHostedAgent } from '../services/agent-config';
import type { AgentConfig } from '../types';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

function checkAdminAuth(req: Request, res: Response): boolean {
  if (!ADMIN_SECRET) {
    res.status(503).json({ error: 'Admin API not configured' });
    return false;
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function handleRegisterAgent(req: Request, res: Response): void {
  if (!checkAdminAuth(req, res)) return;

  const config = req.body as Partial<AgentConfig>;

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

  registerHostedAgent(fullConfig);

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
  if (!checkAdminAuth(req, res)) return;

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
