import { Request, Response } from 'express';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAgentConfig } from '../services/agent-config';
import { runAgent } from '../services/llm';
import { routeRevenueToVault, recordJobOnChain, hashArtifact } from '../services/revenue';
import { swapSolToUsdc } from '../services/jupiter';
import { containerManager } from '../services/container-manager';
import { agentStorage } from '../services/storage';
import { isKmsEnabled } from '../services/kms-signer';
import type { RunRequest, RunResponse } from '../types';

const NATIVE_SOL = 'So11111111111111111111111111111111111111112';

function getGlobalAgentKeypair(): Keypair | null {
  const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!pk) return null;
  try {
    const secretKey = Uint8Array.from(JSON.parse(pk));
    return Keypair.fromSecretKey(secretKey);
  } catch {
    return null;
  }
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
    let llmResponse: { output: string; inputTokens?: number; outputTokens?: number };

    if (agent.isContainerized) {
      const containerResult = await containerManager.proxyRequest(agentId, { input, context }, agent.containerIp);
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
    // Try per-agent keypair first, fall back to global AGENT_WALLET_PRIVATE_KEY
    const agentKeypair = useKms ? null : (agentStorage.getKeypair(agentId) || getGlobalAgentKeypair());
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

    const canSign = useKms || agentKeypair;
    const vaultPubkey = agent.vault ? new PublicKey(agent.vault) : null;

    const elapsed = Date.now() - startTime;
    console.log(`[run] LLM done in ${elapsed}ms, tokens: ${llmResponse.inputTokens}+${llmResponse.outputTokens}`);

    const response: RunResponse = {
      output: llmResponse.output,
      agentId,
      jobId: null,
      receiptTx: null,
      revenueTx: null,
    };

    res.json(response);

    if (canSign && operatorPubkey && vaultPubkey) {
      console.log(`[run] Firing background tx: vault=${vaultPubkey.toBase58()}, usdcAmount=${usdcAmount}`);
      Promise.allSettled([
        usdcAmount > 0 && agentKeypair
          ? routeRevenueToVault(agentKeypair, vaultPubkey, operatorPubkey, usdcAmount, jobTimestamp)
          : Promise.resolve(null),
        recordJobOnChain(agentKeypair, vaultPubkey, artifactHash, agent.priceUsdcMicro, paymentTx),
      ]).then(([revResult, recResult]) => {
        if (revResult.status === 'rejected') console.error('[run] Revenue routing failed:', revResult.reason);
        if (recResult.status === 'rejected') console.error('[run] Job recording failed:', recResult.reason);
        const rev = revResult.status === 'fulfilled' ? revResult.value : null;
        const rec = recResult.status === 'fulfilled' ? recResult.value : null;
        console.log(`[run] Background tx done: revenue=${rev?.txSignature ?? 'none'}, receipt=${rec?.txSignature ?? 'none'}`);
      });
    }
  } catch (err) {
    console.error(`[run] Failed for agent ${agentId}:`, err);
    const message = err instanceof Error ? err.message : 'Agent execution failed';
    res.status(500).json({ error: message });
  }
}

export function getAgentPrice(agentId: string): Promise<number | null> {
  return getAgentConfig(agentId).then(agent => agent?.priceUsdcMicro ?? null);
}
