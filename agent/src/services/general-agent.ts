import Anthropic from '@anthropic-ai/sdk';
import { ToolName, getToolDefinitions, GeneralToolExecutor } from './general-tools';

const MODEL = 'claude-sonnet-4-20250514';

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
const DEFAULT_MAX_ITERATIONS = 15;

export interface AgentRequest {
  agentId: string;
  objective: string;
  systemPrompt: string;
  tools: ToolName[];
  context?: string;
  workspacePath?: string;
  maxIterations?: number;
}

export interface AgentStep {
  iteration: number;
  type: 'thinking' | 'tool_use' | 'tool_result' | 'final';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface AgentResponse {
  success: boolean;
  output: string;
  steps: AgentStep[];
  toolsUsed: string[];
  iterations: number;
  memoryStats: {
    totalMemories: number;
    byCategory: Record<string, number>;
  };
}

export async function runGeneralAgent(request: AgentRequest): Promise<AgentResponse> {
  const {
    agentId,
    objective,
    systemPrompt,
    tools,
    context,
    workspacePath,
    maxIterations = DEFAULT_MAX_ITERATIONS,
  } = request;

  const executor = new GeneralToolExecutor(agentId, workspacePath);
  const toolDefinitions = getToolDefinitions(tools);
  const steps: AgentStep[] = [];
  const toolsUsed = new Set<string>();

  const initialPrompt = buildInitialPrompt(objective, context, tools);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: initialPrompt },
  ];

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
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
    memoryStats: executor.getMemoryStats(),
  };
}

function buildInitialPrompt(objective: string, context?: string, tools?: ToolName[]): string {
  let prompt = `## Objective\n${objective}`;

  if (context) {
    prompt += `\n\n## Context\n${context}`;
  }

  if (tools && tools.length > 0) {
    prompt += `\n\n## Available Tools\nYou have access to: ${tools.join(', ')}`;
    prompt += '\n\nUse these tools strategically to accomplish your objective.';
  }

  prompt += '\n\nWhen you have completed the objective or gathered sufficient information, provide your final response.';

  return prompt;
}
