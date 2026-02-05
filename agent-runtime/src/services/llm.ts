import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig } from '../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

  let userMessage = input;
  if (context && Object.keys(context).length > 0) {
    userMessage = `Context:\n${JSON.stringify(context, null, 2)}\n\nUser Input:\n${input}`;
  }

  const response = await anthropic.messages.create({
    model: agent.model,
    max_tokens: 4096,
    system: agent.systemPrompt,
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
