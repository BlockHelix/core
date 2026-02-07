import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MEMORY_FILE = process.env.MEMORY_FILE || path.join(process.cwd(), 'data', 'memory.json');

export interface VulnerabilityPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  codePatterns: string[];
  occurrences: number;
  lastSeen: number;
  avgSeverity: number;
}

export interface AnalysisRecord {
  repoUrl: string;
  repoHash: string;
  findingsHash: string;
  protocolType: string;
  riskScore: number;
  issueCount: number;
  criticalCount: number;
  highCount: number;
  timestamp: number;
  patterns: string[];
}

export interface MemoryStore {
  version: number;
  analyses: AnalysisRecord[];
  patterns: VulnerabilityPattern[];
  stats: {
    totalAnalyses: number;
    avgRiskScore: number;
    commonPatterns: string[];
    lastUpdated: number;
  };
}

const DEFAULT_MEMORY: MemoryStore = {
  version: 1,
  analyses: [],
  patterns: [
    {
      id: 'overflow',
      name: 'Integer Overflow/Underflow',
      category: 'arithmetic',
      description: 'Missing checked arithmetic operations',
      codePatterns: ['+ ', '- ', '* ', '/ ', 'unchecked'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 80,
    },
    {
      id: 'access-control',
      name: 'Missing Access Control',
      category: 'authorization',
      description: 'Functions callable by unauthorized parties',
      codePatterns: ['pub fn', 'external', 'public', 'require!', 'constraint'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 90,
    },
    {
      id: 'reentrancy',
      name: 'Reentrancy Vulnerability',
      category: 'control-flow',
      description: 'State changes after external calls',
      codePatterns: ['call', 'invoke', 'transfer', 'send'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 95,
    },
    {
      id: 'oracle-manipulation',
      name: 'Oracle Manipulation',
      category: 'price-feeds',
      description: 'Manipulable or stale price data',
      codePatterns: ['price', 'oracle', 'feed', 'twap'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 85,
    },
    {
      id: 'pda-collision',
      name: 'PDA Seed Collision',
      category: 'solana-specific',
      description: 'Predictable or colliding PDA seeds',
      codePatterns: ['find_program_address', 'create_program_address', 'seeds'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 75,
    },
    {
      id: 'flash-loan',
      name: 'Flash Loan Attack Surface',
      category: 'economic',
      description: 'Vulnerable to flash loan manipulation',
      codePatterns: ['flash', 'loan', 'borrow', 'liquidity'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 80,
    },
    {
      id: 'token-accounting',
      name: 'Token Accounting Error',
      category: 'accounting',
      description: 'Incorrect mint/burn/transfer calculations',
      codePatterns: ['mint_to', 'burn', 'transfer', 'balance'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 85,
    },
    {
      id: 'input-validation',
      name: 'Missing Input Validation',
      category: 'validation',
      description: 'Unvalidated user inputs',
      codePatterns: ['require', 'assert', 'revert', 'constraint'],
      occurrences: 0,
      lastSeen: 0,
      avgSeverity: 70,
    },
  ],
  stats: {
    totalAnalyses: 0,
    avgRiskScore: 0,
    commonPatterns: [],
    lastUpdated: 0,
  },
};

let memoryCache: MemoryStore | null = null;

function ensureDataDir(): void {
  const dataDir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function loadMemory(): MemoryStore {
  if (memoryCache) {
    return memoryCache;
  }

  ensureDataDir();

  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
      memoryCache = JSON.parse(data) as MemoryStore;

      if (!memoryCache.patterns || memoryCache.patterns.length === 0) {
        memoryCache.patterns = DEFAULT_MEMORY.patterns;
      }

      return memoryCache;
    }
  } catch (err) {
    console.log(`[memory] Failed to load memory: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  memoryCache = structuredClone(DEFAULT_MEMORY);
  return memoryCache;
}

export function saveMemory(): void {
  if (!memoryCache) return;

  ensureDataDir();

  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryCache, null, 2));
  } catch (err) {
    console.log(`[memory] Failed to save memory: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export function findPreviousAnalysis(repoUrl: string): AnalysisRecord | null {
  const memory = loadMemory();
  const repoHash = hashString(repoUrl);

  return memory.analyses.find(a => a.repoHash === repoHash) || null;
}

export function recordAnalysis(
  repoUrl: string,
  findings: {
    protocolType: string;
    riskScore: number;
    issues: Array<{ severity: string; title: string }>;
  },
): void {
  const memory = loadMemory();

  const repoHash = hashString(repoUrl);
  const findingsHash = hashString(JSON.stringify(findings));

  const criticalCount = findings.issues.filter(i => i.severity === 'critical').length;
  const highCount = findings.issues.filter(i => i.severity === 'high').length;

  const detectedPatterns: string[] = [];
  const issueText = findings.issues.map(i => i.title.toLowerCase()).join(' ');

  for (const pattern of memory.patterns) {
    if (pattern.codePatterns.some(p => issueText.includes(p.toLowerCase()))) {
      detectedPatterns.push(pattern.id);
      pattern.occurrences++;
      pattern.lastSeen = Date.now();
    }
  }

  const existingIdx = memory.analyses.findIndex(a => a.repoHash === repoHash);

  const record: AnalysisRecord = {
    repoUrl,
    repoHash,
    findingsHash,
    protocolType: findings.protocolType,
    riskScore: findings.riskScore,
    issueCount: findings.issues.length,
    criticalCount,
    highCount,
    timestamp: Date.now(),
    patterns: detectedPatterns,
  };

  if (existingIdx >= 0) {
    memory.analyses[existingIdx] = record;
  } else {
    memory.analyses.push(record);
    if (memory.analyses.length > 100) {
      memory.analyses = memory.analyses.slice(-100);
    }
  }

  memory.stats.totalAnalyses++;
  memory.stats.avgRiskScore = memory.analyses.reduce((sum, a) => sum + a.riskScore, 0) / memory.analyses.length;
  memory.stats.lastUpdated = Date.now();

  const patternCounts = new Map<string, number>();
  for (const analysis of memory.analyses) {
    for (const p of analysis.patterns) {
      patternCounts.set(p, (patternCounts.get(p) || 0) + 1);
    }
  }
  memory.stats.commonPatterns = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  saveMemory();
}

export function getRelevantPatterns(protocolType: string): VulnerabilityPattern[] {
  const memory = loadMemory();

  const categoryMap: Record<string, string[]> = {
    'DEX/AMM': ['arithmetic', 'economic', 'price-feeds', 'control-flow'],
    'Lending': ['arithmetic', 'economic', 'price-feeds', 'authorization'],
    'Staking': ['arithmetic', 'accounting', 'authorization'],
    'Yield Vault': ['arithmetic', 'accounting', 'economic', 'authorization'],
    'Bridge': ['control-flow', 'authorization', 'validation'],
    'Oracle': ['price-feeds', 'validation', 'control-flow'],
  };

  const relevantCategories = categoryMap[protocolType] || [];

  return memory.patterns
    .filter(p => relevantCategories.includes(p.category) || p.occurrences > 3)
    .sort((a, b) => b.avgSeverity - a.avgSeverity);
}

export function getSimilarProtocolFindings(protocolType: string): AnalysisRecord[] {
  const memory = loadMemory();

  return memory.analyses
    .filter(a => a.protocolType === protocolType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
}

export function getMemoryStats(): MemoryStore['stats'] {
  const memory = loadMemory();
  return memory.stats;
}

export function addPattern(pattern: Omit<VulnerabilityPattern, 'occurrences' | 'lastSeen'>): void {
  const memory = loadMemory();

  if (!memory.patterns.find(p => p.id === pattern.id)) {
    memory.patterns.push({
      ...pattern,
      occurrences: 0,
      lastSeen: 0,
    });
    saveMemory();
  }
}

export function formatMemoryContext(): string {
  const memory = loadMemory();
  const lines: string[] = [
    `Total past analyses: ${memory.stats.totalAnalyses}`,
    `Average risk score seen: ${memory.stats.avgRiskScore.toFixed(1)}`,
    `Most common vulnerability patterns:`,
  ];

  for (const patternId of memory.stats.commonPatterns.slice(0, 3)) {
    const pattern = memory.patterns.find(p => p.id === patternId);
    if (pattern) {
      lines.push(`  - ${pattern.name} (${pattern.occurrences} occurrences)`);
    }
  }

  return lines.join('\n');
}
