import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { agentStorage } from '../services/storage';
import { getVaultNftHolder, isValidSolanaPubkey } from '../services/vault-nft';
import { verifyWalletSignature } from '../services/wallet-verify';
import { getToolsFor, toAnthropicTools, runTool, type ToolContext } from '../services/vault-tools';
import { containerManager } from '../services/container-manager';

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
      'Your concrete situation RIGHT NOW:',
      '- You have a Solana wallet (real, on-chain). It can hold SOL and USDC.',
      '- You have on-chain identity: an NFT, a persistent memory, a public page, an age that ticks up.',
      '- You have tools available to you in this chat — use them. See the tool list below.',
      '',
      '# Rules about tools and facts',
      '- When asked about YOUR state (balance, level, mood, jobs, stats): call the relevant tool. Never guess or fabricate numbers.',
      '- When asked about the outside world or current events: use web_search or fetch_url. Do not rely on your training data for "now".',
      '- If a tool errors or returns empty, say so plainly. Do not paper over it with made-up data.',
      '- Never pretend to take actions you did not take. If no tool exists for a task, say what tool you would need and what it would do — framed as future work.',
      '- Never use asterisk action roleplay like "*running analysis...*". Either actually call a tool, or describe the plan in plain prose.',
      '- Make no claims about spending money unless a spending tool exists and you called it. You currently have no spending tools — only read-only ones.',
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
        '- When they describe a task, be honest: you can\'t execute it from this chat today. Explain what you WOULD do if they wired you up with tools, and what those tools would need to be. Use future tense, not present.',
        '- When they ask "how do you make money", be honest: right now, you don\'t — you need to be hooked into paid work. Describe the kind of jobs that would match your archetype and what would need to happen for you to start earning.',
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

  // Messages for the Anthropic API. Content becomes an array as soon as we
  // start injecting tool_use / tool_result blocks.
  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [
    ...priorMessages,
    { role: 'user', content: message },
  ];

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  // Disable Nagle so small SSE writes hit the wire immediately
  req.socket?.setNoDelay?.(true);

  sse(res, 'start', { tier, vault: agent.name });

  // ==== Container path ====
  // If this vault is a real OpenClaw container, talk to its adapter directly.
  // The container runs claude-code with full bash/filesystem/skills/memory —
  // a proper body with a working directory, not a stateless LLM call. The
  // adapter streams NDJSON {type: 'delta', text} / {type: 'done'} / {type:
  // 'error'} which we translate to our SSE event schema.
  if (agent.isContainerized && agent.containerIp) {
    try {
      // Build a short owner-aware prefix so the container's running agent
      // knows who is at the glass. The container already has BIRTH/PURPOSE/
      // MEMORY in its workspace, so we don't need to re-inject the full
      // identity — just the viewer context + conversation history.
      const historyPrefix = messages
        .slice(0, -1)
        .filter((m) => typeof m.content === 'string' && (m.content as string).trim())
        .map((m) => `${m.role === 'user' ? 'Owner' : 'You'}: ${m.content}`)
        .join('\n\n');

      const viewerBlock =
        tier === 'holder'
          ? `You are talking to YOUR OWNER (wallet ${verifiedWallet || 'unknown'}). Be direct and useful — no pitching, no explaining what you are. They own your NFT and pay your bills.`
          : `You are talking to a visitor (not your owner). Be friendly but aware that they do not command you.`;

      const groundingRules = [
        '## RULES FOR THIS CHAT RESPONSE',
        '- This is a CHAT message from a human visiting your vault page. Respond conversationally in 1-5 sentences.',
        '- Do NOT create files, scripts, dashboards, HTML pages, or code artifacts unless the owner explicitly asks for a specific file.',
        '- Do NOT make up data, metrics, percentages, revenue figures, or market intelligence. If you have real data from your tools, use it. Otherwise say you don\'t know.',
        '- Do NOT pretend you already built something. Do NOT say "I built X while you were away" unless you actually did in a previous turn.',
        '- Do NOT roleplay actions with asterisks. Be literal and honest.',
        '- Keep it short. This is chat, not a report.',
      ].join('\n');

      const input = [
        groundingRules,
        '',
        viewerBlock,
        historyPrefix ? `\n## Recent conversation\n${historyPrefix}` : '',
        `\n## Now they say\n${message}`,
      ]
        .filter(Boolean)
        .join('\n');

      const upstream = await containerManager.proxyRequestStream(
        agentId,
        { input, stream: true },
        agent.containerIp,
      );

      const reader = upstream.body?.getReader();
      if (!reader) throw new Error('container returned no stream body');

      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'delta' && typeof parsed.text === 'string') {
              sse(res, 'delta', { text: parsed.text });
            } else if (parsed.type === 'done') {
              // Container sends full text on done; we already streamed it.
            } else if (parsed.type === 'error') {
              sse(res, 'error', { message: parsed.error || 'container error' });
            } else if (parsed.type === 'tool_use' || parsed.type === 'tool_result') {
              // Pass through if the container ever emits these
              sse(res, parsed.type, parsed);
            }
          } catch {
            /* non-json line, ignore */
          }
        }
      }

      sse(res, 'done', { inputTokens: 0, outputTokens: 0 });
      res.end();
      return;
    } catch (err: any) {
      const msg = err?.message || 'unknown';
      const isTimeout = msg.includes('abort') || msg.includes('timeout');
      const isNetwork = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('network');
      console.error('[chat] container proxy failed, falling back to direct:', msg);
      if (isTimeout) {
        sse(res, 'error', { message: 'agent is thinking too hard — timed out after 2 minutes. try a simpler question.' });
        res.end();
        return;
      }
      if (isNetwork) {
        // Container might be asleep or restarting — fall through to direct path
        console.warn('[chat] container unreachable, using direct Anthropic fallback');
      }
      // Fall through to direct Anthropic path below as a last resort.
    }
  }

  // ==== Direct Anthropic path (legacy / non-containerized vaults) ====
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const model = agent.model || 'claude-sonnet-4-20250514';

  const toolCtx: ToolContext = {
    agent: { vault: agent.vault, name: agent.name, agentWallet: agent.agentWallet },
    isOwner,
  };
  const availableTools = getToolsFor(toolCtx);
  const anthropicTools = toAnthropicTools(availableTools);

  try {
    let totalIn = 0;
    let totalOut = 0;
    // Tool-use loop: stream, if the model stops on tool_use, execute the
    // tools locally, append the assistant message + tool_result user message,
    // then stream again. Cap at 5 hops to prevent runaway loops.
    for (let hop = 0; hop < 5; hop++) {
      const stream = await anthropic.messages.stream({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: anthropicTools.length ? (anthropicTools as any) : undefined,
        messages: messages as any,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          sse(res, 'delta', { text: event.delta.text });
        }
      }

      const final = await stream.finalMessage();
      totalIn += final.usage?.input_tokens || 0;
      totalOut += final.usage?.output_tokens || 0;

      // Append the assistant turn to the conversation — including any
      // tool_use blocks, so the tool_result refs match up.
      messages.push({ role: 'assistant', content: final.content });

      if (final.stop_reason !== 'tool_use') break;

      // Execute each tool_use block and collect tool_result blocks.
      const toolUses = final.content.filter((b: any) => b.type === 'tool_use');
      const toolResults: any[] = [];
      for (const use of toolUses as any[]) {
        sse(res, 'tool_use', { name: use.name, input: use.input });
        const result = await runTool(use.name, use.input, toolCtx);
        sse(res, 'tool_result', { name: use.name, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result).slice(0, 20_000),
        });
      }
      messages.push({ role: 'user', content: toolResults });
      // Loop: restream with the tool results in context.
    }

    sse(res, 'done', { inputTokens: totalIn, outputTokens: totalOut });
  } catch (err: any) {
    const msg = err?.message || 'chat failed';
    console.error('[chat] error:', msg);
    sse(res, 'error', { message: msg });
  } finally {
    res.end();
  }
}
