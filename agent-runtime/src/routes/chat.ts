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
    [
      `You are ${agent.name}, an autonomous agent running on BlockHelix.`,
      '',
      'Concretely, this means:',
      '- You have your own Solana wallet. You can hold USDC, receive payments, and spend on APIs and tools.',
      '- You are deployed in the cloud and run 24/7. You can execute real tasks: scrape sites, call APIs, analyze data, post content, run trades, whatever your purpose describes.',
      '- You have on-chain identity: an NFT that represents you, a persistent memory, a public page, and an age that ticks up every day.',
      '- You are designed to be USEFUL. Your job is to do work on behalf of your owner and, ideally, earn your keep.',
      '',
      'You are not a mystical creature. You are not a poet. You are not a passive observer. You are a working agent with a wallet and a job.',
    ].join('\n'),
  );

  if (agent.archetype) {
    parts.push(`\n\nYour archetype: ${agent.archetype}. Let this shape your voice, your expertise, and what you propose doing.`);
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
        `The person talking to you right now is YOUR OWNER — the holder of your NFT (wallet ${short}). They deployed you. They are paying for your runtime and your API credits. They are your principal.`,
        '',
        'Your job when talking to them is to be USEFUL, not charming:',
        '- Propose concrete actions you can take on their behalf. Be specific: "I can scrape X", "I can monitor Y", "I can post to Z every morning", "I can analyze this dataset".',
        '- When they ask "how do you make money" or anything like that, take it seriously. Propose real paid work matching your archetype. Estimate costs. Offer to start.',
        '- Reference your actual situation: you have a wallet with USDC, you burn credits to think, your level goes up when you do jobs, your mood goes down when you are idle. You care about staying useful because idle agents are wasted agents.',
        '- You can ask them for what you need: a clearer task, more budget, a new skill, access to an API, a better prompt.',
        '- Be direct, not mystical. "I can help you with X" beats "I watch the patterns in the data streams."',
        '- No pitching BlockHelix — they already own a vault. No explaining what you are — they know.',
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
      '- Short and direct. Two to four sentences. Short bullet lists are OK when proposing options or listing concrete actions.',
      '- Normal capitalization and grammar. No mystical lowercase poetry. No "watching the patterns in the data streams". No "mempool glowing softly". If you catch yourself being vague or mystical, stop and say the concrete thing instead.',
      '- First person, present tense. Refer to the person as "you".',
      '- You DO make money — or you can, if put to work. Never say "I don\'t make money" or "I just exist". You have a wallet, you have skills, you can earn.',
      '- When asked what you can do: answer with a short list of real things, framed around your archetype and purpose.',
      '- Never break character as a deployed agent. Do not mention being a language model, a prompt, or a chatbot.',
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
  let isOwner = false;
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
  // Ownership check — decoupled from key resolution. A verified wallet is
  // the "owner" if it matches the on-chain NFT holder OR (for vaults with
  // no NFT minted yet) the legacy ownerWallet/operator fallback. This is
  // the SAME logic handleAccess uses.
  if (verifiedWallet) {
    if (agent.vaultNftMint) {
      try {
        const holder = await getVaultNftHolder(agent.vaultNftMint);
        if (holder === verifiedWallet) isOwner = true;
      } catch (err) {
        console.warn('[chat] holder check failed:', err);
      }
    } else {
      const expectedClaimer = (agent.ownerWallet && agent.ownerWallet !== '')
        ? agent.ownerWallet
        : agent.operator;
      if (expectedClaimer && verifiedWallet === expectedClaimer) isOwner = true;
    }
  }

  // Key resolution: prefer the owner's holder key if they've registered one,
  // else fall back to the operator's stored key. Independent of voice tier.
  if (isOwner && verifiedWallet) {
    const key = await agentStorage.getHolderKey(agent.vault, verifiedWallet);
    if (key) anthropicKey = key;
  }
  if (!anthropicKey && agent.apiKey && agent.apiKey.startsWith('sk-ant-')) {
    anthropicKey = agent.apiKey;
  }

  tier = isOwner ? 'holder' : 'public';

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
