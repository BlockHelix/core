import { Request, Response } from 'express';
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import { getAgentConfig } from '../services/agent-config';
import { runAgent } from '../services/llm';
import { routeRevenueToVault, recordJobOnChain, hashArtifact } from '../services/revenue';
import { swapSolToUsdc } from '../services/jupiter';
import type { RunRequest, RunResponse } from '../types';

const AGENT_WALLET_PATH = process.env.AGENT_WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
const NATIVE_SOL = 'So11111111111111111111111111111111111111112';

function loadKeypair(path: string): Keypair {
  const raw = fs.readFileSync(path, 'utf-8');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

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

    // Check if payment was in SOL (from x402 settlement)
    const settlementHeader = req.headers['x-payment-settlement'] as string;
    let paymentAsset = 'usdc';
    let paymentAmount = agent.priceUsdcMicro;

    if (settlementHeader) {
      try {
        const settlement = JSON.parse(Buffer.from(settlementHeader, 'base64').toString());
        if (settlement.asset === NATIVE_SOL) {
          paymentAsset = 'sol';
          paymentAmount = parseInt(settlement.amount) || 300000;
        }
      } catch { /* ignore parse errors */ }
    }

    // If paid in SOL, swap to USDC for vault routing
    let usdcAmount = agent.priceUsdcMicro;
    if (paymentAsset === 'sol') {
      console.log(`[run] SOL payment detected (${paymentAmount} lamports), swapping to USDC...`);
      const agentKeypair = loadKeypair(AGENT_WALLET_PATH);
      const swapResult = await swapSolToUsdc(agentKeypair, paymentAmount);
      if (swapResult) {
        usdcAmount = swapResult.outputAmount;
        console.log(`[run] Swapped to ${usdcAmount} micro-USDC`);
      } else {
        console.log('[run] Swap failed, skipping vault routing for this payment');
        usdcAmount = 0;
      }
    }

    const jobTimestamp = Date.now();

    const [revenueResult, receiptResult] = await Promise.allSettled([
      usdcAmount > 0 ? routeRevenueToVault(AGENT_WALLET_PATH, usdcAmount, jobTimestamp) : Promise.resolve(null),
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
