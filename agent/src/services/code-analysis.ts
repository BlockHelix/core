import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AnalysisRequest {
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
}

export interface AnalysisResult {
  analysis: string;
  issues: Issue[];
  riskScore: number;
  filesAnalyzed: string[];
}

export interface PatchRequest {
  repoUrl: string;
  filePath: string;
  issueDescription: string;
  analysisId?: string;
}

export interface PatchResult {
  patch: string;
  explanation: string;
  affectedFiles: string[];
}

const DEFI_ANALYSIS_SYSTEM = `You are a DeFi security auditor specializing in Solana/Anchor programs, EVM smart contracts, and blockchain protocol security. You analyze code for:

- Arithmetic overflow/underflow (missing checked math)
- Access control flaws (missing signer checks, authority validation)
- Reentrancy and cross-program invocation vulnerabilities
- Token accounting errors (incorrect mint/burn/transfer logic)
- PDA seed collision risks
- Oracle manipulation vectors
- Flash loan attack surfaces
- Incorrect fee calculations
- State inconsistencies and race conditions
- Missing input validation

Always provide actionable, specific findings with exact code locations.`;

const DEFI_PATCH_SYSTEM = `You are a DeFi developer specializing in secure smart contract patches. You generate precise, minimal patches that:

- Fix the specific vulnerability without introducing new issues
- Use checked arithmetic for all math operations
- Maintain backward compatibility
- Include proper access control
- Follow the codebase's existing patterns and style

Output patches in unified diff format that can be directly applied.`;

async function runGitClone(repoUrl: string, dest: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', ['clone', '--depth', '1', repoUrl, dest], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('git clone timed out'));
    }, 30000);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`git clone failed (code ${code}): ${stderr.trim()}`));
    });
  });
}

async function cloneRepo(repoUrl: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blockhelix-'));
  try {
    await runGitClone(repoUrl, `${tmpDir}/repo`);
  } catch {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Failed to clone repo: ${repoUrl}`);
  }
  return path.join(tmpDir, 'repo');
}

function readRepoFiles(repoPath: string, filePath?: string): { files: Record<string, string>; fileList: string[] } {
  const files: Record<string, string> = {};
  const fileList: string[] = [];

  if (filePath) {
    const fullPath = path.join(repoPath, filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      files[filePath] = content;
      fileList.push(filePath);
    }

    const dir = path.dirname(fullPath);
    if (fs.existsSync(dir)) {
      const siblings = fs.readdirSync(dir).filter(f => {
        const ext = path.extname(f);
        return ['.rs', '.ts', '.sol', '.js', '.move', '.py'].includes(ext);
      });
      for (const sibling of siblings.slice(0, 5)) {
        const sibPath = path.join(dir, sibling);
        const relPath = path.relative(repoPath, sibPath);
        if (!files[relPath]) {
          try {
            files[relPath] = fs.readFileSync(sibPath, 'utf-8');
            fileList.push(relPath);
          } catch { /* skip unreadable */ }
        }
      }
    }
  } else {
    const extensions = ['.rs', '.sol', '.ts', '.move'];
    const srcDirs = ['programs', 'src', 'contracts', 'lib'];

    for (const srcDir of srcDirs) {
      const dirPath = path.join(repoPath, srcDir);
      if (!fs.existsSync(dirPath)) continue;
      walkDir(dirPath, repoPath, extensions, files, fileList, 10);
    }

    if (fileList.length === 0) {
      walkDir(repoPath, repoPath, extensions, files, fileList, 5);
    }
  }

  return { files, fileList };
}

function walkDir(
  dir: string,
  basePath: string,
  extensions: string[],
  files: Record<string, string>,
  fileList: string[],
  maxFiles: number,
): void {
  if (fileList.length >= maxFiles) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (fileList.length >= maxFiles) return;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'target') {
        walkDir(fullPath, basePath, extensions, files, fileList, maxFiles);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        const relPath = path.relative(basePath, fullPath);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length < 50000) {
            files[relPath] = content;
            fileList.push(relPath);
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* skip inaccessible dirs */ }
}

function cleanupRepo(repoPath: string): void {
  try {
    const parentDir = path.dirname(repoPath);
    fs.rmSync(parentDir, { recursive: true, force: true });
  } catch { /* best-effort */ }
}

export async function analyzeCodeWithClaude(params: AnalysisRequest): Promise<AnalysisResult> {
  const repoPath = await cloneRepo(params.repoUrl);

  try {
    const { files, fileList } = readRepoFiles(repoPath, params.filePath);

    if (fileList.length === 0) {
      throw new Error('No source files found in repository');
    }

    const fileContents = Object.entries(files)
      .map(([name, content]) => `--- ${name} ---\n${content}`)
      .join('\n\n');

    const focusPrompt = params.focus
      ? `Focus your analysis on: ${params.focus}`
      : 'Perform a general DeFi security and code quality analysis.';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: DEFI_ANALYSIS_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Analyze the following code for vulnerabilities, bugs, and improvement opportunities.

${focusPrompt}

Source files:
${fileContents}

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "analysis": "High-level summary of findings (2-3 paragraphs)",
  "issues": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "Brief title",
      "description": "Detailed description",
      "location": "file:line or file:function",
      "recommendation": "How to fix"
    }
  ],
  "riskScore": 0-100
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    let parsed: { analysis: string; issues: Issue[]; riskScore: number };
    try {
      const jsonStr = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        analysis: content.text,
        issues: [],
        riskScore: 50,
      };
    }

    return {
      analysis: parsed.analysis,
      issues: parsed.issues || [],
      riskScore: parsed.riskScore ?? 50,
      filesAnalyzed: fileList,
    };
  } finally {
    cleanupRepo(repoPath);
  }
}

export async function generatePatchWithClaude(params: PatchRequest): Promise<PatchResult> {
  const repoPath = await cloneRepo(params.repoUrl);

  try {
    const { files, fileList } = readRepoFiles(repoPath, params.filePath);

    if (fileList.length === 0) {
      throw new Error('No source files found');
    }

    const fileContents = Object.entries(files)
      .map(([name, content]) => `--- ${name} ---\n${content}`)
      .join('\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: DEFI_PATCH_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Generate a patch to fix the following issue.

Issue: ${params.issueDescription}
Primary file: ${params.filePath}

Source files:
${fileContents}

Respond in this exact JSON format (no markdown, no code blocks, just raw JSON):
{
  "patch": "unified diff format patch content",
  "explanation": "What was changed and why (2-3 sentences)",
  "affectedFiles": ["list", "of", "affected", "files"]
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    let parsed: { patch: string; explanation: string; affectedFiles: string[] };
    try {
      const jsonStr = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        patch: content.text,
        explanation: 'Raw patch output',
        affectedFiles: [params.filePath],
      };
    }

    return parsed;
  } finally {
    cleanupRepo(repoPath);
  }
}
