import { Request, Response } from 'express';
import { runGeneralAgent, AgentRequest } from '../services/general-agent';
import { ToolName } from '../services/general-tools';
import { routeRevenueToVault, recordJobOnChain } from '../services/revenue';
import { hashArtifact } from '../utils/hash';
import { PRICE_AGENT_USDC } from '../utils/x402';

const VALID_TOOLS: ToolName[] = ['memory_search', 'memory_store', 'web_search', 'web_fetch', 'file_read', 'file_list'];

export async function handleAgentRequest(req: Request, res: Response) {
  try {
    const {
      agentId,
      objective,
      systemPrompt,
      tools,
      context,
      workspacePath,
      maxIterations,
    } = req.body as {
      agentId?: string;
      objective?: string;
      systemPrompt?: string;
      tools?: string[];
      context?: string;
      workspacePath?: string;
      maxIterations?: number;
    };

    if (!objective) {
      res.status(400).json({ error: 'objective is required' });
      return;
    }

    if (!systemPrompt) {
      res.status(400).json({ error: 'systemPrompt is required' });
      return;
    }

    const validatedTools: ToolName[] = [];
    if (tools && Array.isArray(tools)) {
      for (const tool of tools) {
        if (VALID_TOOLS.includes(tool as ToolName)) {
          validatedTools.push(tool as ToolName);
        }
      }
    }

    const hasFileTools = validatedTools.includes('file_read') || validatedTools.includes('file_list');
    if (hasFileTools && !workspacePath) {
      res.status(400).json({ error: 'workspacePath is required when using file tools' });
      return;
    }

    const resolvedAgentId = agentId || `agent-${Date.now()}`;

    console.log(`[agent] ${resolvedAgentId} objective="${objective.slice(0, 50)}..." tools=[${validatedTools.join(',')}]`);
    const startTime = Date.now();

    const agentRequest: AgentRequest = {
      agentId: resolvedAgentId,
      objective,
      systemPrompt,
      tools: validatedTools,
      context,
      workspacePath,
      maxIterations: maxIterations || 10,
    };

    const result = await runGeneralAgent(agentRequest);

    const artifactHash = hashArtifact(JSON.stringify(result));
    const paymentAmount = PRICE_AGENT_USDC;
    const paymentTx = req.headers['x-payment-response'] as string
      || req.headers['payment-response'] as string
      || 'x402-settled';

    const [revenueResult, receiptResult] = await Promise.allSettled([
      routeRevenueToVault(paymentAmount, Date.now()),
      recordJobOnChain(artifactHash, paymentAmount, paymentTx),
    ]);

    const revenue = revenueResult.status === 'fulfilled' ? revenueResult.value : null;
    const receipt = receiptResult.status === 'fulfilled' ? receiptResult.value : null;

    const elapsed = Date.now() - startTime;
    console.log(`[agent] ${resolvedAgentId} completed in ${elapsed}ms iterations=${result.iterations} tools=${result.toolsUsed.join(',')}`);

    res.json({
      agentId: resolvedAgentId,
      success: result.success,
      output: result.output,
      metrics: {
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
        stepsCount: result.steps.length,
        durationMs: elapsed,
      },
      memory: result.memoryStats,
      steps: result.steps,
      onChain: {
        revenueRouted: revenue !== null,
        revenueTx: revenue?.txSignature || null,
        receiptRecorded: receipt !== null,
        receiptTx: receipt?.txSignature || null,
        jobId: receipt?.jobId ?? null,
        artifactHash: artifactHash.toString('hex'),
      },
    });
  } catch (err) {
    console.error('[agent] failed:', err);
    const message = err instanceof Error ? err.message : 'Agent execution failed';
    res.status(500).json({ error: message });
  }
}
