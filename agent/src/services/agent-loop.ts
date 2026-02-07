import Anthropic from '@anthropic-ai/sdk';
import { AGENT_TOOLS, ToolExecutor } from './agent-tools';
import { EmbeddingMemory, getSharedMemory } from './embedding-memory';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_ITERATIONS = 15;
const MODEL = 'claude-sonnet-4-20250514';

export interface AgentTask {
  repoPath: string;
  repoUrl: string;
  objective: string;
  context?: string;
}

export interface AgentStep {
  iteration: number;
  type: 'thinking' | 'tool_use' | 'tool_result' | 'final';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output: string;
  steps: AgentStep[];
  toolsUsed: string[];
  iterations: number;
}

const SYSTEM_PROMPT = `You are an expert DeFi security auditor with deep knowledge of smart contract vulnerabilities.

You have access to tools to help with your analysis:
- memory_search: Search past analyses and learnings
- memory_store: Save important findings for future reference
- web_search: Search for vulnerabilities, exploits, documentation
- web_fetch: Read web pages (audit reports, docs)
- repo_read: Read source code files
- repo_list: List directory contents

Your analysis process:
1. Start by listing the repository structure to understand the codebase
2. Search memory for relevant past findings about similar protocols
3. Read the key source files (especially entry points like lib.rs, main contracts)
4. Search the web for known vulnerabilities in similar protocols
5. Take notes on important findings using memory_store
6. Perform deep analysis of critical code paths
7. Synthesize findings into a comprehensive report

Focus on:
- Solana/Anchor: PDA seed collisions, CPI attacks, account validation, signer checks
- EVM: reentrancy, flash loan attacks, oracle manipulation, access control
- Economic: MEV, sandwich attacks, price manipulation, vault share inflation
- Arithmetic: overflow/underflow, precision loss, rounding errors

Be thorough but efficient. Use tools strategically. When you have enough information, provide your final analysis.`;

export async function runAgentLoop(task: AgentTask): Promise<AgentResult> {
  const memory = getSharedMemory('defidata-agent');
  const executor = new ToolExecutor(task.repoPath, memory);
  const steps: AgentStep[] = [];
  const toolsUsed = new Set<string>();

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: buildInitialPrompt(task),
    },
  ];

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    });

    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    let textContent = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
      }
    }

    if (textContent) {
      steps.push({
        iteration,
        type: 'thinking',
        content: textContent,
      });
    }

    if (response.stop_reason === 'end_turn' && toolUseBlocks.length === 0) {
      steps.push({
        iteration,
        type: 'final',
        content: textContent,
      });
      break;
    }

    if (toolUseBlocks.length === 0) {
      break;
    }

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolName = toolUse.name;
      const toolInput = toolUse.input as Record<string, unknown>;

      steps.push({
        iteration,
        type: 'tool_use',
        content: `Using ${toolName}`,
        toolName,
        toolInput,
      });

      toolsUsed.add(toolName);

      const result = await executor.execute(toolName, toolInput);

      const truncatedContent = result.content.length > 10000
        ? result.content.slice(0, 10000) + '\n...[truncated]'
        : result.content;

      steps.push({
        iteration,
        type: 'tool_result',
        content: truncatedContent.slice(0, 500) + (truncatedContent.length > 500 ? '...' : ''),
        toolName,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: truncatedContent,
        is_error: result.isError,
      });
    }

    messages.push({
      role: 'user',
      content: toolResults,
    });
  }

  const finalStep = steps.find(s => s.type === 'final');
  const output = finalStep?.content || steps[steps.length - 1]?.content || 'No output generated';

  return {
    success: true,
    output,
    steps,
    toolsUsed: Array.from(toolsUsed),
    iterations: iteration,
  };
}

function buildInitialPrompt(task: AgentTask): string {
  let prompt = `Analyze this repository for security vulnerabilities:

Repository: ${task.repoUrl}

Objective: ${task.objective}`;

  if (task.context) {
    prompt += `\n\nAdditional context:\n${task.context}`;
  }

  prompt += `

Perform a thorough security analysis:
1. First, list the repository structure to understand the codebase
2. Search your memory for relevant past findings
3. Read the main source files
4. Search for known vulnerabilities in similar protocols
5. Store important findings in memory
6. Provide a comprehensive analysis

When you have gathered enough information, provide your final analysis in this JSON format:
{
  "analysis": "2-3 paragraph summary of findings",
  "issues": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "Brief title",
      "description": "Detailed description",
      "location": "file:line or file:function",
      "recommendation": "How to fix",
      "confidence": 1-10
    }
  ],
  "riskScore": 0-100,
  "architecture": "One paragraph architecture summary"
}`;

  return prompt;
}

export async function runQuickAnalysis(
  repoPath: string,
  repoUrl: string,
  focus?: string
): Promise<AgentResult> {
  const objective = focus
    ? `Perform a focused security analysis on: ${focus}`
    : 'Perform a comprehensive DeFi security audit';

  return runAgentLoop({
    repoPath,
    repoUrl,
    objective,
  });
}
