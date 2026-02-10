import { Request, Response } from 'express';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAgentConfig } from '../services/agent-config';
import { runAgent } from '../services/llm';
import { routeRevenueToVault, recordJobOnChain, hashArtifact } from '../services/revenue';
import { swapSolToUsdc } from '../services/jupiter';
import { containerManager } from '../services/container-manager';
import { agentStorage } from '../services/storage';
import { isKmsEnabled } from '../services/kms-signer';
import { eventIndexer } from '../services/event-indexer';
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
  eventIndexer.incrementApiCalls(agentId);
  const startTime = Date.now();

  const wantStream = req.body.stream === true && agent.isContainerized;

  try {
    const paymentTx = req.headers['x-payment-response'] as string
      || req.headers['payment-response'] as string
      || 'x402-settled';

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
    const globalKeypair = getGlobalAgentKeypair();
    const agentKeypair = agentStorage.getKeypair(agentId) || globalKeypair;
    const receiptKeypair = useKms ? null : agentKeypair;
    const operatorPubkey = agent.operator ? new PublicKey(agent.operator) : null;

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

    const canSign = useKms || agentKeypair;
    const vaultPubkey = agent.vault ? new PublicKey(agent.vault) : null;

    const fireBackgroundTx = (output: string) => {
      const artifactHash = hashArtifact(JSON.stringify({ agentId, input, output, timestamp: Date.now() }));
      const jobTimestamp = Date.now();
      if (canSign && operatorPubkey && vaultPubkey) {
        console.log(`[run] Firing background tx: vault=${vaultPubkey.toBase58()}, usdcAmount=${usdcAmount}`);
        Promise.allSettled([
          usdcAmount > 0 && agentKeypair
            ? routeRevenueToVault(agentKeypair, vaultPubkey, operatorPubkey, usdcAmount, jobTimestamp)
            : Promise.resolve(null),
          recordJobOnChain(receiptKeypair, vaultPubkey, artifactHash, agent.priceUsdcMicro, paymentTx),
        ]).then(([revResult, recResult]) => {
          if (revResult.status === 'rejected') console.error('[run] Revenue routing failed:', revResult.reason);
          if (recResult.status === 'rejected') console.error('[run] Job recording failed:', recResult.reason);
          const rev = revResult.status === 'fulfilled' ? revResult.value : null;
          const rec = recResult.status === 'fulfilled' ? recResult.value : null;
          console.log(`[run] Background tx done: revenue=${rev?.txSignature ?? 'none'}, receipt=${rec?.txSignature ?? 'none'}`);
        });
      }
    };

    if (wantStream) {
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const upstream = await containerManager.proxyRequestStream(
        agentId,
        { input, context, systemPrompt: agent.systemPrompt, stream: true },
        agent.containerIp,
      );

      let fullOutput = '';

      const reader = upstream.body?.getReader();
      if (!reader) {
        res.write(JSON.stringify({ type: 'error', error: 'No stream body from container' }) + '\n');
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            res.write(line + '\n');
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'done' && parsed.text) {
                fullOutput = parsed.text;
              }
            } catch { /* non-json line, just forward */ }
          }
        }

        if (buffer.trim()) {
          res.write(buffer + '\n');
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === 'done' && parsed.text) fullOutput = parsed.text;
          } catch {}
        }
      } catch (err) {
        console.error(`[run] Stream read error for agent ${agentId}:`, err);
        if (!res.writableEnded) {
          res.write(JSON.stringify({ type: 'error', error: 'Stream interrupted' }) + '\n');
        }
      }

      if (!res.writableEnded) res.end();

      const elapsed = Date.now() - startTime;
      console.log(`[run] Stream done in ${elapsed}ms for agent ${agentId}`);
      if (fullOutput) fireBackgroundTx(fullOutput);
    } else {
      let llmResponse: { output: string; inputTokens?: number; outputTokens?: number };

      if (agent.isContainerized) {
        const containerResult = await containerManager.proxyRequest(agentId, { input, context, systemPrompt: agent.systemPrompt }, agent.containerIp);
        llmResponse = { output: containerResult.output, inputTokens: 0, outputTokens: 0 };
      } else {
        llmResponse = await runAgent({ agent, input, context });
      }

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
      fireBackgroundTx(llmResponse.output);
    }
  } catch (err) {
    console.error(`[run] Failed for agent ${agentId}:`, err);
    const message = err instanceof Error ? err.message : 'Agent execution failed';
    if (wantStream && res.headersSent) {
      if (!res.writableEnded) {
        res.write(JSON.stringify({ type: 'error', error: message }) + '\n');
        res.end();
      }
    } else if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
}

export function getAgentPrice(agentId: string): Promise<number | null> {
  return getAgentConfig(agentId).then(agent => agent?.priceUsdcMicro ?? null);
}
