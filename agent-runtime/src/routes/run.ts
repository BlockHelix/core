import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { getAgentConfig } from '../services/agent-config';
import { runAgent } from '../services/llm';
import { routeRevenueToVault, recordJobOnChain, hashArtifact } from '../services/revenue';
import { swapSolToUsdc } from '../services/jupiter';
import { containerManager } from '../services/container-manager';
import { agentStorage } from '../services/storage';
import { isKmsEnabled } from '../services/kms-signer';
import type { RunRequest, RunResponse } from '../types';

const NATIVE_SOL = 'So11111111111111111111111111111111111111112';

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
    let llmResponse: { output: string; inputTokens?: number; outputTokens?: number };

    if (agent.isContainerized) {
      const containerResult = await containerManager.proxyRequest(agentId, { input, context });
      llmResponse = { output: containerResult.output, inputTokens: 0, outputTokens: 0 };
    } else {
      llmResponse = await runAgent({ agent, input, context });
    }

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

    const useKms = isKmsEnabled();
    const agentKeypair = useKms ? null : agentStorage.getKeypair(agentId);
    const operatorPubkey = agent.operator ? new PublicKey(agent.operator) : null;

    // If paid in SOL, swap to USDC for vault routing (only if we have a keypair)
    let usdcAmount = agent.priceUsdcMicro;
    if (paymentAsset === 'sol' && agentKeypair) {
      console.log(`[run] SOL payment detected (${paymentAmount} lamports), swapping to USDC...`);
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

    let revenueResult = null;
    let receiptResult = null;

    const canSign = useKms || agentKeypair;
    if (canSign && operatorPubkey) {
      const [revResult, recResult] = await Promise.allSettled([
        usdcAmount > 0 && agentKeypair
          ? routeRevenueToVault(agentKeypair, operatorPubkey, usdcAmount, jobTimestamp)
          : Promise.resolve(null),
        recordJobOnChain(agentKeypair, operatorPubkey, artifactHash, agent.priceUsdcMicro, paymentTx),
      ]);
      revenueResult = revResult.status === 'fulfilled' ? revResult.value : null;
      receiptResult = recResult.status === 'fulfilled' ? recResult.value : null;
      if (useKms) console.log('[run] Signed receipt with KMS');
    } else {
      console.log('[run] No signing capability or operator, skipping on-chain recording');
    }

    const elapsed = Date.now() - startTime;
    console.log(`[run] Completed in ${elapsed}ms, tokens: ${llmResponse.inputTokens}+${llmResponse.outputTokens}`);

    const response: RunResponse = {
      output: llmResponse.output,
      agentId,
      jobId: receiptResult?.jobId ?? null,
      receiptTx: receiptResult?.txSignature ?? null,
      revenueTx: revenueResult?.txSignature ?? null,
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
