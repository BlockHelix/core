import { Request, Response } from 'express';
import { smartAnalyze } from '../services/smart-analysis';
import { analyzeCodeWithClaude } from '../services/code-analysis';
import { routeRevenueToVault, recordJobOnChain } from '../services/revenue';
import { hashArtifact } from '../utils/hash';
import { PRICE_ANALYZE_USDC } from '../utils/x402';

export async function analyzeCode(req: Request, res: Response) {
  try {
    const { repoUrl, filePath, focus, mode } = req.body as {
      repoUrl?: string;
      filePath?: string;
      focus?: string;
      mode?: 'smart' | 'fast';
    };

    if (!repoUrl) {
      res.status(400).json({ error: 'repoUrl is required' });
      return;
    }

    if (!repoUrl.includes('github.com')) {
      res.status(400).json({ error: 'Only GitHub repositories are supported' });
      return;
    }

    const useSmartMode = mode !== 'fast';
    console.log(`[analyze] ${repoUrl} ${filePath || '(full repo)'} mode=${useSmartMode ? 'smart' : 'fast'}`);
    const startTime = Date.now();

    let result;
    if (useSmartMode) {
      result = await smartAnalyze({ repoUrl, filePath, focus });
    } else {
      const basicResult = await analyzeCodeWithClaude({ repoUrl, filePath, focus });
      result = {
        ...basicResult,
        protocolType: 'Unknown',
        architecture: '',
        webResearch: { searchesPerformed: 0, relevantFindings: [] },
        memoryContext: { similarProtocolsAnalyzed: 0, relevantPatterns: [] },
        passes: { architecture: false, webResearch: false, deepDive: false, synthesis: false },
      };
    }

    const artifactHash = hashArtifact(JSON.stringify(result));
    const paymentAmount = PRICE_ANALYZE_USDC;
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
    console.log(`[analyze] completed in ${elapsed}ms, revenue=${!!revenue}, receipt=${!!receipt}`);

    res.json({
      ...result,
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
    console.error('[analyze] failed:', err);
    const message = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ error: message });
  }
}
