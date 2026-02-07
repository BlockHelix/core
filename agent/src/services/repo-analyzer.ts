import fs from 'fs';
import path from 'path';

export interface FileInfo {
  path: string;
  content: string;
  language: 'rust' | 'solidity' | 'typescript' | 'javascript' | 'move' | 'unknown';
  size: number;
  importance: number;
  isEntryPoint: boolean;
  imports: string[];
  exports: string[];
  publicFunctions: FunctionSignature[];
}

export interface FunctionSignature {
  name: string;
  visibility: 'public' | 'external' | 'internal' | 'private' | 'unknown';
  params: string[];
  returnType?: string;
  line?: number;
}

export interface DependencyGraph {
  nodes: Map<string, FileInfo>;
  edges: Map<string, string[]>;
}

export interface RepoAnalysis {
  files: FileInfo[];
  graph: DependencyGraph;
  entryPoints: string[];
  protocolType: string;
  mainComponents: string[];
  externalDeps: string[];
}

const LANGUAGE_EXTENSIONS: Record<string, FileInfo['language']> = {
  '.rs': 'rust',
  '.sol': 'solidity',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.move': 'move',
};

const ENTRY_POINT_PATTERNS = [
  /^lib\.rs$/,
  /^main\.rs$/,
  /^mod\.rs$/,
  /^index\.ts$/,
  /^index\.js$/,
  /^main\.ts$/,
  /^main\.js$/,
  /\.sol$/,
];

const TEST_PATTERNS = [
  /test/i,
  /spec/i,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
];

const UTIL_PATTERNS = [
  /util/i,
  /helper/i,
  /common/i,
  /shared/i,
];

function detectLanguage(filePath: string): FileInfo['language'] {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_EXTENSIONS[ext] || 'unknown';
}

function isEntryPoint(filePath: string, content: string): boolean {
  const fileName = path.basename(filePath);

  if (ENTRY_POINT_PATTERNS.some(p => p.test(fileName))) {
    return true;
  }

  if (filePath.endsWith('.rs')) {
    if (content.includes('#[program]') || content.includes('declare_id!')) {
      return true;
    }
  }

  if (filePath.endsWith('.sol')) {
    if (content.includes('contract ') && !content.includes('abstract contract')) {
      return true;
    }
  }

  return false;
}

function calculateImportance(filePath: string, content: string, isEntry: boolean): number {
  let score = 50;

  if (isEntry) score += 30;

  if (TEST_PATTERNS.some(p => p.test(filePath))) {
    score -= 40;
  }

  if (UTIL_PATTERNS.some(p => p.test(filePath))) {
    score -= 10;
  }

  const publicCount = (content.match(/\bpub\b|\bpublic\b|\bexternal\b|\bexport\b/g) || []).length;
  score += Math.min(publicCount * 2, 20);

  if (content.includes('transfer') || content.includes('mint') || content.includes('burn')) {
    score += 10;
  }

  if (content.includes('authority') || content.includes('owner') || content.includes('admin')) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

function parseRustImports(content: string): string[] {
  const imports: string[] = [];
  const useRegex = /use\s+([\w:]+)/g;
  const modRegex = /mod\s+(\w+)/g;

  let match;
  while ((match = useRegex.exec(content))) {
    imports.push(match[1]);
  }
  while ((match = modRegex.exec(content))) {
    imports.push(match[1]);
  }

  return imports;
}

function parseRustExports(content: string): string[] {
  const exports: string[] = [];
  const pubRegex = /pub\s+(?:fn|struct|enum|mod|const|type|trait)\s+(\w+)/g;

  let match;
  while ((match = pubRegex.exec(content))) {
    exports.push(match[1]);
  }

  return exports;
}

function parseRustFunctions(content: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];
  const fnRegex = /(?:(pub)\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^\{]+))?/g;

  let match;
  while ((match = fnRegex.exec(content))) {
    const visibility = match[1] ? 'public' : 'private';
    const name = match[2];
    const paramsStr = match[3];
    const returnType = match[4]?.trim();

    const params = paramsStr.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    functions.push({ name, visibility, params, returnType });
  }

  return functions;
}

function parseSolidityImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;

  let match;
  while ((match = importRegex.exec(content))) {
    imports.push(match[1]);
  }

  return imports;
}

function parseSolidityExports(content: string): string[] {
  const exports: string[] = [];
  const contractRegex = /(?:contract|interface|library)\s+(\w+)/g;

  let match;
  while ((match = contractRegex.exec(content))) {
    exports.push(match[1]);
  }

  return exports;
}

function parseSolidityFunctions(content: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];
  const fnRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*((?:external|public|internal|private)?[^{]*)/g;

  let match;
  while ((match = fnRegex.exec(content))) {
    const name = match[1];
    const paramsStr = match[2];
    const modifiers = match[3] || '';

    let visibility: FunctionSignature['visibility'] = 'unknown';
    if (modifiers.includes('external')) visibility = 'external';
    else if (modifiers.includes('public')) visibility = 'public';
    else if (modifiers.includes('internal')) visibility = 'internal';
    else if (modifiers.includes('private')) visibility = 'private';

    const params = paramsStr.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const returnMatch = modifiers.match(/returns\s*\(([^)]+)\)/);
    const returnType = returnMatch?.[1]?.trim();

    functions.push({ name, visibility, params, returnType });
  }

  return functions;
}

function parseTypeScriptImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+["']([^"']+)["']/g;
  const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;

  let match;
  while ((match = importRegex.exec(content))) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content))) {
    imports.push(match[1]);
  }

  return imports;
}

function parseTypeScriptExports(content: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
  const exportDefaultRegex = /export\s+default\s+(?:function|class)?\s*(\w+)?/g;

  let match;
  while ((match = exportRegex.exec(content))) {
    exports.push(match[1]);
  }
  while ((match = exportDefaultRegex.exec(content))) {
    if (match[1]) exports.push(match[1]);
  }

  return exports;
}

function parseTypeScriptFunctions(content: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\{]+))?/g;
  const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)(?:\s*:\s*[^=]+)?\s*=>/g;

  let match;
  while ((match = fnRegex.exec(content))) {
    const name = match[1];
    const paramsStr = match[2];
    const returnType = match[3]?.trim();

    const params = paramsStr.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const visibility = content.includes(`export function ${name}`) ? 'public' : 'private';
    functions.push({ name, visibility, params, returnType });
  }
  while ((match = arrowRegex.exec(content))) {
    functions.push({
      name: match[1],
      visibility: content.includes(`export const ${match[1]}`) ? 'public' : 'private',
      params: [],
    });
  }

  return functions;
}

function parseFile(filePath: string, content: string): FileInfo {
  const language = detectLanguage(filePath);
  const isEntry = isEntryPoint(filePath, content);

  let imports: string[] = [];
  let exports: string[] = [];
  let publicFunctions: FunctionSignature[] = [];

  switch (language) {
    case 'rust':
      imports = parseRustImports(content);
      exports = parseRustExports(content);
      publicFunctions = parseRustFunctions(content);
      break;
    case 'solidity':
      imports = parseSolidityImports(content);
      exports = parseSolidityExports(content);
      publicFunctions = parseSolidityFunctions(content);
      break;
    case 'typescript':
    case 'javascript':
      imports = parseTypeScriptImports(content);
      exports = parseTypeScriptExports(content);
      publicFunctions = parseTypeScriptFunctions(content);
      break;
  }

  return {
    path: filePath,
    content,
    language,
    size: content.length,
    importance: calculateImportance(filePath, content, isEntry),
    isEntryPoint: isEntry,
    imports,
    exports,
    publicFunctions: publicFunctions.filter(f => f.visibility === 'public' || f.visibility === 'external'),
  };
}

function detectProtocolType(files: FileInfo[]): string {
  const allContent = files.map(f => f.content.toLowerCase()).join(' ');

  const patterns: [RegExp, string][] = [
    [/swap|amm|pool.*token|liquidity.*provider/i, 'DEX/AMM'],
    [/borrow|lend|collateral|interest.*rate|utilization/i, 'Lending'],
    [/stake|validator|delegation|unstake/i, 'Staking'],
    [/vault.*deposit|yield.*farm|strategy/i, 'Yield Vault'],
    [/nft|erc721|metaplex|collection/i, 'NFT'],
    [/bridge|cross.*chain|relay/i, 'Bridge'],
    [/oracle|price.*feed|chainlink/i, 'Oracle'],
    [/governance|proposal|vote|dao/i, 'Governance'],
    [/token.*mint|erc20|spl.*token/i, 'Token'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(allContent)) {
      return type;
    }
  }

  return 'Unknown DeFi Protocol';
}

function detectMainComponents(files: FileInfo[]): string[] {
  const components = new Set<string>();

  for (const file of files) {
    if (file.language === 'rust') {
      const modMatch = file.content.match(/pub mod (\w+)/g);
      modMatch?.forEach(m => {
        const name = m.replace('pub mod ', '');
        if (!['tests', 'test', 'utils', 'util'].includes(name)) {
          components.add(name);
        }
      });
    }

    if (file.language === 'solidity') {
      const contractMatch = file.content.match(/contract\s+(\w+)/g);
      contractMatch?.forEach(m => {
        const name = m.replace('contract ', '');
        components.add(name);
      });
    }

    for (const fn of file.publicFunctions) {
      if (fn.name.length > 3 && !['new', 'init', 'get', 'set'].includes(fn.name)) {
        components.add(fn.name);
      }
    }
  }

  return Array.from(components).slice(0, 15);
}

function detectExternalDeps(files: FileInfo[]): string[] {
  const deps = new Set<string>();

  for (const file of files) {
    for (const imp of file.imports) {
      if (imp.startsWith('@') || imp.startsWith('solana') || imp.startsWith('anchor')) {
        deps.add(imp.split('/')[0].split('::')[0]);
      }
      if (imp.includes('openzeppelin') || imp.includes('chainlink')) {
        deps.add(imp.split('/')[1] || imp);
      }
    }
  }

  return Array.from(deps);
}

function buildDependencyGraph(files: FileInfo[]): DependencyGraph {
  const nodes = new Map<string, FileInfo>();
  const edges = new Map<string, string[]>();

  for (const file of files) {
    nodes.set(file.path, file);
    edges.set(file.path, []);
  }

  for (const file of files) {
    const deps: string[] = [];

    for (const imp of file.imports) {
      const importName = path.basename(imp).replace(/\.\w+$/, '');

      for (const other of files) {
        if (other.path === file.path) continue;

        const otherName = path.basename(other.path).replace(/\.\w+$/, '');
        if (otherName === importName || other.exports.includes(importName)) {
          deps.push(other.path);
        }
      }
    }

    edges.set(file.path, deps);
  }

  return { nodes, edges };
}

export function analyzeRepo(repoPath: string, filePaths?: string[]): RepoAnalysis {
  const files: FileInfo[] = [];

  if (filePaths && filePaths.length > 0) {
    for (const relativePath of filePaths) {
      const fullPath = path.join(repoPath, relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length < 100000) {
            files.push(parseFile(relativePath, content));
          }
        } catch { /* skip unreadable */ }
      }
    }
  } else {
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
            const relativePath = path.relative(repoPath, fullPath);
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              if (content.length < 100000) {
                files.push(parseFile(relativePath, content));
              }
            } catch { /* skip */ }
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
  }

  files.sort((a, b) => b.importance - a.importance);

  const graph = buildDependencyGraph(files);

  for (const file of files) {
    const incomingCount = Array.from(graph.edges.values())
      .filter(deps => deps.includes(file.path))
      .length;
    file.importance = Math.min(100, file.importance + incomingCount * 3);
  }

  files.sort((a, b) => b.importance - a.importance);

  return {
    files,
    graph,
    entryPoints: files.filter(f => f.isEntryPoint).map(f => f.path),
    protocolType: detectProtocolType(files),
    mainComponents: detectMainComponents(files),
    externalDeps: detectExternalDeps(files),
  };
}

export function getHighPriorityFiles(analysis: RepoAnalysis, maxFiles = 10): FileInfo[] {
  return analysis.files
    .filter(f => f.importance >= 40 || f.isEntryPoint)
    .slice(0, maxFiles);
}

export function summarizeAnalysis(analysis: RepoAnalysis): string {
  const lines: string[] = [
    `Protocol Type: ${analysis.protocolType}`,
    `Files Analyzed: ${analysis.files.length}`,
    `Entry Points: ${analysis.entryPoints.join(', ') || 'none detected'}`,
    `Main Components: ${analysis.mainComponents.slice(0, 10).join(', ')}`,
    `External Dependencies: ${analysis.externalDeps.slice(0, 10).join(', ')}`,
    '',
    'Top Files by Importance:',
  ];

  for (const file of analysis.files.slice(0, 5)) {
    lines.push(`  ${file.path} (${file.importance}/100, ${file.publicFunctions.length} public fns)`);
  }

  return lines.join('\n');
}
