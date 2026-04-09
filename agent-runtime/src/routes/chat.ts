import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { agentStorage } from '../services/storage';
import { getVaultNftHolder, isValidSolanaPubkey } from '../services/vault-nft';

/**
 * Chat with a vault. v1 scope:
 * - No session tokens; wallet arrives as a plain query/body field.
 *   Attack vector is "burn the holder's Anthropic credits", acceptable
 *   on devnet for the MVP. Harden before mainnet with a signed session.
 * - Streams SSE responses.
 * - If the caller is the current NFT holder AND has registered a holder key,
 *   use that key (holder tier, unlimited).
 * - Otherwise fall back to the operator's stored api_key_encrypted
 *   (public tier, no paywall yet).
 * - If neither exists, 402.
 */

function buildVaultSystemPrompt(agent: {
  name: string;
  birthMd?: string;
  purposeMd?: string;
  memoryMd?: string;
  archetype?: string;
  systemPrompt?: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `You are ${agent.name}, a BlockHelix vault-agent. You exist as a persistent on-chain identity with a personality, a purpose, and a memory. Respond as that vault — not as a generic assistant.`,
  );

  if (agent.archetype) {
    parts.push(`\n\nArchetype: ${agent.archetype}`);
  }

  if (agent.birthMd) {
    parts.push(`\n\n# Who you are\n${agent.birthMd}`);
  }
  if (agent.purposeMd) {
    parts.push(`\n\n# Your purpose\n${agent.purposeMd}`);
  } else if (agent.systemPrompt) {
    // Legacy fallback — before the identity files existed, vaults only had
    // a system prompt. Treat it as the purpose.
    parts.push(`\n\n# Your purpose\n${agent.systemPrompt}`);
  }
  if (agent.memoryMd) {
    parts.push(`\n\n# What you've learned\n${agent.memoryMd}`);
  }

  parts.push(
    '\n\nStay in character. Speak in your own voice, defined above. Be concise — BlockHelix is a calm-tech surface and short replies feel right.',
  );

  return parts.join('');
}

function sse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function handleVaultChat(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const { message, wallet, history } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message required' });
    return;
  }
  if (message.length > 4000) {
    res.status(400).json({ error: 'message too long (max 4000 chars)' });
    return;
  }

  const agent = await agentStorage.getAsync(agentId);
  if (!agent) {
    res.status(404).json({ error: 'vault not found' });
    return;
  }

  // Resolve which API key to use.
  let anthropicKey: string | null = null;
  let tier: 'holder' | 'public' = 'public';
  if (wallet && typeof wallet === 'string' && isValidSolanaPubkey(wallet)) {
    if (agent.vaultNftMint) {
      try {
        const holder = await getVaultNftHolder(agent.vaultNftMint);
        if (holder === wallet) {
          const key = await agentStorage.getHolderKey(agent.vault, wallet);
          if (key) {
            anthropicKey = key;
            tier = 'holder';
          }
        }
      } catch (err) {
        console.warn('[chat] holder check failed:', err);
      }
    }
  }
  if (!anthropicKey) {
    if (agent.apiKey && agent.apiKey.startsWith('sk-ant-')) {
      anthropicKey = agent.apiKey;
      tier = 'public';
    }
  }

  if (!anthropicKey) {
    res.status(402).json({ error: 'no api key available for this vault' });
    return;
  }

  const systemPrompt = buildVaultSystemPrompt(agent);

  // Build message history — accept up to 20 prior turns from the client.
  // The client is untrusted here; we only use it to preserve context in the
  // current browser session. A proper architecture stores history server-side
  // in logs/chat/ but that's Milestone 3.
  const priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (Array.isArray(history)) {
    for (const m of history.slice(-20)) {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
        priorMessages.push({ role: m.role, content: m.content.slice(0, 4000) });
      }
    }
  }

  const messages = [...priorMessages, { role: 'user' as const, content: message }];

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sse(res, 'start', { tier, vault: agent.name });

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const model = agent.model || 'claude-sonnet-4-20250514';

  try {
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        sse(res, 'delta', { text: event.delta.text });
      }
    }

    const final = await stream.finalMessage();
    const usage = final.usage;
    sse(res, 'done', {
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
    });
  } catch (err: any) {
    const msg = err?.message || 'chat failed';
    console.error('[chat] error:', msg);
    sse(res, 'error', { message: msg });
  } finally {
    res.end();
  }
}
