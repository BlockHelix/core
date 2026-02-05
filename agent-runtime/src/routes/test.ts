import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const rateLimits = new Map<string, { count: number; resetTime: number }>();

interface TestRequest {
  systemPrompt: string;
  input: string;
  apiKey: string;
}

interface TestResponse {
  output: string;
  model: string;
  tokensUsed: number;
}

function getRateLimitKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0] : req.socket.remoteAddress || 'unknown';
  return `test:${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(key, {
      count: 1,
      resetTime: now + 60_000,
    });
    return true;
  }

  if (limit.count >= 5) {
    return false;
  }

  limit.count += 1;
  return true;
}

export async function handleTest(req: Request, res: Response): Promise<void> {
  const rateLimitKey = getRateLimitKey(req);

  if (!checkRateLimit(rateLimitKey)) {
    res.status(429).json({
      error: 'Rate limit exceeded. Maximum 5 test calls per minute.',
    });
    return;
  }

  const { systemPrompt, input, apiKey } = req.body as TestRequest;

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'apiKey is required and must be a string' });
    return;
  }

  if (!systemPrompt || typeof systemPrompt !== 'string') {
    res.status(400).json({ error: 'systemPrompt is required and must be a string' });
    return;
  }

  if (!input || typeof input !== 'string') {
    res.status(400).json({ error: 'input is required and must be a string' });
    return;
  }

  if (systemPrompt.length > 10_000) {
    res.status(400).json({ error: 'systemPrompt exceeds maximum length (10,000 characters)' });
    return;
  }

  if (input.length > 2_000) {
    res.status(400).json({ error: 'input exceeds maximum length (2,000 characters)' });
    return;
  }

  console.log(`[test] Testing agent, system prompt length: ${systemPrompt.length}, input length: ${input.length}`);
  const startTime = Date.now();

  try {
    const anthropic = new Anthropic({
      apiKey,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    const elapsed = Date.now() - startTime;
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    console.log(`[test] Completed in ${elapsed}ms, tokens: ${response.usage.input_tokens}+${response.usage.output_tokens}`);

    const testResponse: TestResponse = {
      output: content.text,
      model: 'claude-sonnet-4-20250514',
      tokensUsed,
    };

    res.json(testResponse);
  } catch (err) {
    console.error('[test] Failed:', err);
    const message = err instanceof Error ? err.message : 'Test execution failed';
    res.status(500).json({ error: message });
  }
}
