import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig } from '../types';
import { buildSystemPrompt } from './platform-soul';

export interface LLMRequest {
  agent: AgentConfig;
  input: string;
  context?: Record<string, unknown>;
}

export interface LLMResponse {
  output: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runAgent(request: LLMRequest): Promise<LLMResponse> {
  const { agent, input, context } = request;

  const anthropic = new Anthropic({
    apiKey: agent.apiKey,
  });

  let userMessage = input;
  if (context && Object.keys(context).length > 0) {
    userMessage = `Context:\n${JSON.stringify(context, null, 2)}\n\nUser Input:\n${input}`;
  }

  const systemPrompt = await buildSystemPrompt(agent);

  const response = await anthropic.messages.create({
    model: agent.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Claude');
  }

  return {
    output: content.text,
    model: agent.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
