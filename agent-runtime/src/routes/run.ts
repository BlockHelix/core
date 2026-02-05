import { Request, Response } from 'express';
import { getAgentConfig } from '../services/agent-config';
import { runAgent } from '../services/llm';
import { routeRevenueToVault, recordJobOnChain, hashArtifact } from '../services/revenue';
import type { RunRequest, RunResponse } from '../types';

const AGENT_WALLET_PATH = process.env.AGENT_WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

export async function handleRun(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const { input, context } = req.body as RunRequest;

  if (!input || typeof input !== 'string') {
    res.status(400).json({ error: 'input is required and must be a string' });
    return;
  }

  const agent = await getAgentConfig(agentId);
  if (!agent) {
    res.status(404).json({ error: `Agent not found: ${agentId}` });
    return;
  }

  if (!agent.isActive) {
    res.status(403).json({ error: 'Agent is not active' });
    return;
  }

  console.log(`[run] Agent ${agentId} (${agent.name}), input length: ${input.length}`);
  const startTime = Date.now();

  try {
    const llmResponse = await runAgent({ agent, input, context });

    const artifactHash = hashArtifact(JSON.stringify({
      agentId,
      input,
      output: llmResponse.output,
      timestamp: Date.now(),
    }));

    const paymentTx = req.headers['x-payment-response'] as string
      || req.headers['payment-response'] as string
      || 'x402-settled';

    const jobTimestamp = Date.now();

    const [revenueResult, receiptResult] = await Promise.allSettled([
      routeRevenueToVault(AGENT_WALLET_PATH, agent.priceUsdcMicro, jobTimestamp),
      recordJobOnChain(AGENT_WALLET_PATH, artifactHash, agent.priceUsdcMicro, paymentTx),
    ]);

    const revenue = revenueResult.status === 'fulfilled' ? revenueResult.value : null;
    const receipt = receiptResult.status === 'fulfilled' ? receiptResult.value : null;

    const elapsed = Date.now() - startTime;
    console.log(`[run] Completed in ${elapsed}ms, tokens: ${llmResponse.inputTokens}+${llmResponse.outputTokens}`);

    const response: RunResponse = {
      output: llmResponse.output,
      agentId,
      jobId: receipt?.jobId ?? null,
      receiptTx: receipt?.txSignature ?? null,
      revenueTx: revenue?.txSignature ?? null,
    };

    res.json(response);
  } catch (err) {
    console.error(`[run] Failed for agent ${agentId}:`, err);
    const message = err instanceof Error ? err.message : 'Agent execution failed';
    res.status(500).json({ error: message });
  }
}

export function getAgentPrice(agentId: string): Promise<number | null> {
  return getAgentConfig(agentId).then(agent => agent?.priceUsdcMicro ?? null);
}
