import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runAgentLoop } from './agent-loop';
import { getSharedMemory } from './embedding-memory';

export interface SmartAnalysisRequest {
  repoUrl: string;
  filePath?: string;
  focus?: string;
}

export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: string;
  recommendation: string;
  confidence: number;
  pattern?: string;
}

export interface SmartAnalysisResult {
  analysis: string;
  issues: Issue[];
  riskScore: number;
  filesAnalyzed: string[];
  protocolType: string;
  architecture: string;
  webResearch: {
    searchesPerformed: number;
    relevantFindings: string[];
  };
  memoryContext: {
    similarProtocolsAnalyzed: number;
    relevantPatterns: string[];
  };
  passes: {
    architecture: boolean;
    webResearch: boolean;
    deepDive: boolean;
    synthesis: boolean;
  };
  agentMetrics: {
    iterations: number;
    toolsUsed: string[];
    stepsCount: number;
  };
}

function cloneRepo(repoUrl: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blockhelix-smart-'));
  try {
    execSync(`git clone --depth 1 ${repoUrl} ${tmpDir}/repo`, {
      timeout: 30000,
      stdio: 'pipe',
    });
  } catch {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Failed to clone repo: ${repoUrl}`);
  }
  return path.join(tmpDir, 'repo');
}

function cleanupRepo(repoPath: string): void {
  try {
    const parentDir = path.dirname(repoPath);
    fs.rmSync(parentDir, { recursive: true, force: true });
  } catch { /* best-effort */ }
}

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function collectAnalyzedFiles(repoPath: string): string[] {
  const files: string[] = [];
  const extensions = ['.rs', '.sol', '.ts', '.js', '.move'];
  const srcDirs = ['programs', 'src', 'contracts', 'lib', 'sources'];

  function walkDir(dir: string, maxFiles: number): void {
    if (files.length >= maxFiles) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'target') {
            walkDir(fullPath, maxFiles);
          }
        } else if (extensions.includes(path.extname(entry.name))) {
          files.push(path.relative(repoPath, fullPath));
        }
      }
    } catch { /* skip */ }
  }

  for (const srcDir of srcDirs) {
    const dirPath = path.join(repoPath, srcDir);
    if (fs.existsSync(dirPath)) {
      walkDir(dirPath, 30);
    }
  }

  if (files.length === 0) {
    walkDir(repoPath, 20);
  }

  return files;
}

export async function smartAnalyze(params: SmartAnalysisRequest): Promise<SmartAnalysisResult> {
  const repoPath = cloneRepo(params.repoUrl);

  try {
    const repoInfo = parseRepoUrl(params.repoUrl);
    const protocolName = repoInfo?.repo || 'unknown-protocol';

    let objective = 'Perform a comprehensive DeFi security audit';
    if (params.focus) {
      objective = `Focus security analysis on: ${params.focus}`;
    }
    if (params.filePath) {
      objective += `. Pay special attention to file: ${params.filePath}`;
    }

    const agentResult = await runAgentLoop({
      repoPath,
      repoUrl: params.repoUrl,
      objective,
      context: `Protocol name: ${protocolName}`,
    });

    let parsed: {
      analysis: string;
      issues: Issue[];
      riskScore: number;
      architecture: string;
    };

    try {
      const jsonMatch = agentResult.output.match(/\{[\s\S]*"analysis"[\s\S]*"issues"[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0]
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        parsed = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      parsed = {
        analysis: agentResult.output,
        issues: [],
        riskScore: 50,
        architecture: 'Could not parse architecture from agent output',
      };
    }

    const memory = getSharedMemory('defidata-agent');
    const memoryStats = memory.getStats();

    const webSearches = agentResult.steps.filter(
      s => s.toolName === 'web_search' || s.toolName === 'web_fetch'
    ).length;

    const filesAnalyzed = collectAnalyzedFiles(repoPath);

    const toolUsageCounts = agentResult.steps
      .filter(s => s.type === 'tool_use')
      .reduce((acc, s) => {
        acc[s.toolName || 'unknown'] = (acc[s.toolName || 'unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    if (parsed.issues && parsed.issues.length > 0) {
      const summaryContent = `Analysis of ${protocolName}: Found ${parsed.issues.length} issues. Risk score: ${parsed.riskScore}. Critical: ${parsed.issues.filter(i => i.severity === 'critical').length}, High: ${parsed.issues.filter(i => i.severity === 'high').length}`;
      await memory.store(summaryContent, 'finding', [protocolName, 'analysis-summary']);
    }

    return {
      analysis: parsed.analysis,
      issues: parsed.issues || [],
      riskScore: parsed.riskScore ?? 50,
      filesAnalyzed,
      protocolType: detectProtocolType(filesAnalyzed, repoPath),
      architecture: parsed.architecture || '',
      webResearch: {
        searchesPerformed: webSearches,
        relevantFindings: agentResult.steps
          .filter(s => s.toolName === 'web_search')
          .map(s => JSON.stringify(s.toolInput).slice(0, 100)),
      },
      memoryContext: {
        similarProtocolsAnalyzed: memoryStats.totalMemories,
        relevantPatterns: Object.keys(memoryStats.byCategory),
      },
      passes: {
        architecture: agentResult.toolsUsed.includes('repo_list'),
        webResearch: agentResult.toolsUsed.includes('web_search'),
        deepDive: agentResult.toolsUsed.includes('repo_read'),
        synthesis: true,
      },
      agentMetrics: {
        iterations: agentResult.iterations,
        toolsUsed: agentResult.toolsUsed,
        stepsCount: agentResult.steps.length,
      },
    };
  } finally {
    cleanupRepo(repoPath);
  }
}

function detectProtocolType(files: string[], repoPath: string): string {
  const allContent: string[] = [];

  for (const file of files.slice(0, 10)) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
      allContent.push(content.toLowerCase());
    } catch { /* skip */ }
  }

  const combined = allContent.join(' ');

  const patterns: [RegExp, string][] = [
    [/swap|amm|pool.*token|liquidity.*provider/i, 'DEX/AMM'],
    [/borrow|lend|collateral|interest.*rate|utilization/i, 'Lending'],
    [/stake|validator|delegation|unstake/i, 'Staking'],
    [/vault.*deposit|yield.*farm|strategy/i, 'Yield Vault'],
    [/nft|erc721|metaplex|collection/i, 'NFT'],
    [/bridge|cross.*chain|relay/i, 'Bridge'],
    [/oracle|price.*feed|chainlink/i, 'Oracle'],
    [/governance|proposal|vote|dao/i, 'Governance'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(combined)) {
      return type;
    }
  }

  return 'Unknown DeFi Protocol';
}
