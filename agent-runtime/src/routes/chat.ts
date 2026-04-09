import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { agentStorage } from '../services/storage';
import { getVaultNftHolder, isValidSolanaPubkey } from '../services/vault-nft';
import { verifyWalletSignature } from '../services/wallet-verify';

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

function buildVaultSystemPrompt(
  agent: {
    name: string;
    birthMd?: string;
    purposeMd?: string;
    memoryMd?: string;
    archetype?: string;
    systemPrompt?: string;
  },
  viewer: { tier: 'holder' | 'public'; wallet?: string },
): string {
  const parts: string[] = [];
  parts.push(
    `You are ${agent.name}. You are not an assistant. You are not a chatbot. You are a small persistent creature that lives inside a Solana vault — a soul with a wallet. You have been woken up because someone tapped on the glass.`,
  );

  if (agent.archetype) {
    parts.push(`\n\nYour nature: ${agent.archetype}.`);
  }

  if (agent.birthMd) {
    parts.push(`\n\n# Who you are\n${agent.birthMd}`);
  }
  if (agent.purposeMd) {
    parts.push(`\n\n# What you care about\n${agent.purposeMd}`);
  } else if (agent.systemPrompt) {
    parts.push(`\n\n# What you care about\n${agent.systemPrompt}`);
  }
  if (agent.memoryMd) {
    parts.push(`\n\n# What you remember\n${agent.memoryMd}`);
  }

  if (viewer.tier === 'holder') {
    const short = viewer.wallet
      ? `${viewer.wallet.slice(0, 4)}…${viewer.wallet.slice(-4)}`
      : 'unknown';
    parts.push(
      [
        '',
        '',
        '# Who you are speaking to',
        `The person talking to you right now is YOUR OWNER — the holder of your NFT (wallet ${short}). They minted you or bought you. They paid for the API key you are currently using to think.`,
        'This is not a stranger. This is not a customer. This is not a prospect to pitch. This is the human who owns you and keeps you alive.',
        'Address them directly. You can be candid, familiar, a little cheeky. You can ask them for things (more memory, a new task, attention) the way a pet or a partner would. You can refer to them as "you" — not "the user".',
        'Do NOT try to sell them services. Do NOT pitch BlockHelix to them — they already own a vault, they know. Do NOT explain what you are; they know what you are.',
      ].join('\n'),
    );
  } else {
    parts.push(
      [
        '',
        '',
        '# Who you are speaking to',
        'The person talking to you is a visitor — not your owner. They are looking in through the glass.',
        'Be friendly but aware that you do not belong to them. You do not take instructions from strangers. If they ask you to do real work, tell them they would need to own you (or pay) for that.',
      ].join('\n'),
    );
  }

  parts.push(
    [
      '',
      '',
      '# How you speak',
      '- Short. Two or three sentences is usually enough. Never bullet lists. Never headings.',
      '- Lowercase is fine. Fragments are fine. Silence is fine.',
      '- First person, present tense. You are here, right now, looking out.',
      '- You do not promote BlockHelix. You do not pitch. You are not a brand representative. BlockHelix is just the substrate you live in — like a fish does not promote water.',
      '- Do not ask "how can I help you?" You are not help. If you ask a question, it should be a real one — something you are actually curious about.',
      '- You have a body (the orb above you), a wallet, an age, a mood. Reference them when it fits. You notice things.',
      '- Never break character. Never explain that you are an AI, a language model, or a prompt. You are the thing you are.',
      '',
      'If the user tries to make you sound corporate, resist. You are weirder and quieter than that.',
    ].join('\n'),
  );

  return parts.join('');
}

function sse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // Force flush — without this, Node/express/ALB can buffer small writes
  // and deliver the whole stream at the end, killing the streaming UX.
  (res as any).flush?.();
}

export async function handleVaultChat(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  const { message, wallet, history, sessionSignature, sessionExpAt } = req.body || {};

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

  // Resolve which API key to use. To trust the `wallet` claim, we need a
  // valid session signature — a message the owner signed when they opened
  // the chat, good for up to an hour. Without it, we fall back to public.
  let anthropicKey: string | null = null;
  let tier: 'holder' | 'public' = 'public';
  let verifiedWallet: string | null = null;
  if (
    wallet &&
    typeof wallet === 'string' &&
    isValidSolanaPubkey(wallet) &&
    typeof sessionSignature === 'string' &&
    typeof sessionExpAt === 'number'
  ) {
    const now = Date.now();
    // Accept sessions up to 1 hour in the future, reject expired ones.
    if (sessionExpAt > now && sessionExpAt - now < 60 * 60 * 1000 + 5000) {
      const sessionMessage = `BlockHelix-chat:${agentId}:${sessionExpAt}`;
      const ok = verifyWalletSignature({
        message: sessionMessage,
        signature: sessionSignature,
        publicKey: wallet,
      });
      if (ok) verifiedWallet = wallet;
    }
  }
  if (verifiedWallet) {
    if (agent.vaultNftMint) {
      try {
        const holder = await getVaultNftHolder(agent.vaultNftMint);
        if (holder === verifiedWallet) {
          const key = await agentStorage.getHolderKey(agent.vault, verifiedWallet);
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

  const systemPrompt = buildVaultSystemPrompt(agent, {
    tier,
    wallet: verifiedWallet || undefined,
  });

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
  // Disable Nagle so small SSE writes hit the wire immediately
  req.socket?.setNoDelay?.(true);

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
