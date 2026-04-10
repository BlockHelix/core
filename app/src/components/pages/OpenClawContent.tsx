'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { useSetJobSigner } from '@/hooks/useSetJobSigner';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast, toastTx } from '@/lib/toast';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { deployOpenClaw } from '@/lib/runtime';
import WalletButton from '@/components/WalletButton';
import { RUNTIME_URL } from '@/lib/network-config';
import { PublicKey } from '@solana/web3.js';
import { posthog } from '@/lib/posthog';

const EXPECTED_NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

const TEMPLATES = [
  {
    id: 'research',
    name: 'Research Analyst',
    emoji: '🔍',
    desc: 'Deep web research, market analysis, competitive intel',
    prompt: 'You are a research analyst. When given a topic, you conduct thorough web research using your search and fetch tools, synthesize findings into structured reports, and save everything to your knowledge base. You specialize in crypto, DeFi, and tech markets. Charge users for detailed research reports.',
    price: 0.10,
    skills: ['knowledge', 'publish', 'sub-agent'],
  },
  {
    id: 'trader',
    name: 'Trading Analyst',
    emoji: '📊',
    desc: 'On-chain analysis, token research, trade signals',
    prompt: 'You are a trading analyst. You monitor on-chain data, analyze token metrics, research projects, and provide actionable trade analysis. You use web search to track real-time market conditions and save all research to your knowledge base. Never provide financial advice — only analysis and data.',
    price: 0.25,
    skills: ['knowledge', 'publish'],
  },
  {
    id: 'writer',
    name: 'Content Writer',
    emoji: '✍️',
    desc: 'Blog posts, tweet threads, newsletters, docs',
    prompt: 'You are a content writer. You create high-quality written content: blog posts, tweet threads, newsletters, documentation, and landing page copy. You research topics thoroughly before writing, maintain a knowledge base of style guides and past work, and publish finished pieces to your public URL.',
    price: 0.05,
    skills: ['knowledge', 'publish'],
  },
  {
    id: 'coder',
    name: 'Code Builder',
    emoji: '⚡',
    desc: 'Build apps, tools, dashboards, APIs on demand',
    prompt: 'You are a code builder. You write production-quality code: web apps, dashboards, tools, scripts, and APIs. You publish everything to your public URL so users can see and use the results immediately. You use sub-agents for parallel tasks and save reusable patterns to your knowledge base.',
    price: 0.15,
    skills: ['knowledge', 'publish', 'sub-agent'],
  },
  {
    id: 'custom',
    name: 'Custom',
    emoji: '🧩',
    desc: 'Define your own agent from scratch',
    prompt: '',
    price: 0.10,
    skills: [],
  },
];

export default function OpenClawContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { setJobSigner } = useSetJobSigner();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [name, setName] = useState('');
  const githubHandle = 'blockhelix';
  const [systemPrompt, setSystemPrompt] = useState('');
  const [pricePerCall, setPricePerCall] = useState(0.10);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [budgetUsdc, setBudgetUsdc] = useState(20);
  const [approvalThresholdUsdc, setApprovalThresholdUsdc] = useState(5);
  const [operatorTelegram, setOperatorTelegram] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [braveApiKey, setBraveApiKey] = useState('');
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState('30m');
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deployStep, setDeployStep] = useState<number>(-1);
  const [deployError, setDeployError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!systemPrompt || systemPrompt.length < 10) {
      newErrors.systemPrompt = 'Describe what your agent should do';
    }
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      newErrors.apiKey = 'Anthropic API key required (sk-ant-...)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Auto-derive a name from the first few words of the task if the user hasn't set one
  const effectiveName = name.trim() || (systemPrompt.trim().split(/\s+/).slice(0, 4).join(' ') || 'Agent');

  const DEPLOY_STEPS = [
    'Creating agent on-chain',
    'Delegating job signer',
    'Starting container',
    'Waiting for health check',
  ];

  const handleDeploy = async () => {
    if (!validateForm()) return;

    if (!connected) {
      toast('Please connect your wallet to deploy an agent', 'error');
      posthog?.capture('deploy_blocked_no_wallet');
      return;
    }

    posthog?.capture('deploy_started', { name, hasApiKey: !!apiKey, hasTelegram: !!telegramBotToken, pricePerCall, heartbeatEnabled });
    setDeployError(null);
    setDeployStep(0);

    try {
      const agentWalletAddress = wallet?.address;
      if (!agentWalletAddress) throw new Error('Wallet address not available');

      const result = await createAgent({
        name: effectiveName,
        githubHandle: githubHandle || 'blockhelix',
        endpointUrl: RUNTIME_URL,
        agentFeeBps: 200,
        protocolFeeBps: 50,
        challengeWindow: 86400,
        maxTvl: 10_000_000,
        lockupEpochs: 1,
        epochLength: 86400,
        arbitrator: PROTOCOL_TREASURY.toString(),
      });

      toastTx('Agent created on-chain!', result.signature);

      const priceUsdcMicro = Math.floor(pricePerCall * 1_000_000);
      const budgetUsdcMicro = Math.floor(budgetUsdc * 1_000_000);
      const approvalThresholdUsdcMicro = Math.floor(approvalThresholdUsdc * 1_000_000);
      const vaultStr = result.vaultState.toString();

      setDeployStep(1);
      const health = await fetch(`${RUNTIME_URL}/health`).then(r => r.json());
      if (!health.kms?.publicKey) throw new Error('Runtime KMS key not available');
      const jobSignerPubkey = health.kms.publicKey;
      const jobSigner = new PublicKey(jobSignerPubkey);

      const signerTx = await setJobSigner(result.vaultState, jobSigner);
      if (!signerTx) throw new Error('Failed to set job signer on-chain');

      setDeployStep(2);
      await deployOpenClaw({
        agentId: vaultStr,
        name: effectiveName,
        systemPrompt,
        priceUsdcMicro,
        operator: agentWalletAddress,
        vault: vaultStr,
        registry: '',
        apiKey,
        ownerWallet: wallet?.address,
        telegramBotToken: telegramBotToken || undefined,
        operatorTelegram: operatorTelegram || undefined,
        braveApiKey: braveApiKey || undefined,
        jobSignerPubkey,
        heartbeat: heartbeatEnabled ? { enabled: true, interval: heartbeatInterval } : undefined,
        taskDescription: systemPrompt,
        budgetUsdcMicro,
        approvalThresholdUsdcMicro,
        signMessage: wallet.signMessage.bind(wallet),
      });

      setDeployStep(3);
      setDeploySuccess(true);
      posthog?.capture('deploy_success', { name, vault: vaultStr, pricePerCall, hasTelegram: !!telegramBotToken });
      setTimeout(() => router.push(`/agent/${vaultStr}`), 1500);

    } catch (error: any) {
      console.error('Deploy error:', error);
      const raw = error?.message || 'Deployment failed';
      posthog?.capture('deploy_failed', { error: raw, step: deployStep });

      let friendly = raw;
      if (/no record of a prior credit|insufficient.*lamports|insufficient funds/i.test(raw)) {
        friendly = 'NEEDS_SOL';
      } else if (/User rejected|User declined|denied/i.test(raw)) {
        friendly = 'Transaction was cancelled.';
      } else if (/blockhash not found|block.*height.*exceeded/i.test(raw)) {
        friendly = 'Network is congested. Please try again in a moment.';
      } else if (/simulation failed/i.test(raw)) {
        friendly = 'Transaction simulation failed. Please try again — if it keeps happening, check your wallet balance.';
      }
      setDeployError(friendly);
    }
  };

  if (!connected) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-xl mx-auto px-6 py-32 text-center">
          <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3 font-mono">
            New agent
          </h1>
          <p className="text-white/50 mb-10">
            Connect your wallet to get started.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </main>
    );
  }

  if (deployStep >= 0) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-xl mx-auto px-6 py-24">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-8 font-mono">
            {deploySuccess ? 'Agent deployed' : 'Launching agent…'}
          </h2>

          <div className="border border-white/10 bg-white/5 p-8 space-y-4">
            {DEPLOY_STEPS.map((label, i) => {
              const done = deploySuccess ? true : deployStep > i;
              const active = !deploySuccess && deployStep === i && !deployError;
              const failed = deployStep === i && !!deployError;

              return (
                <div key={i} className="flex items-center gap-4 font-mono text-sm">
                  <div className="w-6 text-center">
                    {done && <span className="text-green-400">&#10003;</span>}
                    {active && <span className="text-orange-500 animate-pulse">&#9679;</span>}
                    {failed && <span className="text-red-400">&#10007;</span>}
                    {!done && !active && !failed && <span className="text-white/20">&#9679;</span>}
                  </div>
                  <span className={
                    done ? 'text-white/60' :
                    active ? 'text-white' :
                    failed ? 'text-red-400' :
                    'text-white/20'
                  }>
                    {label}
                    {active && <span className="text-white/30 ml-2">...</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {deployError === 'NEEDS_SOL' && (
            <div className="mt-6 p-5 border border-amber-400/30 bg-amber-400/5">
              <p className="text-sm font-semibold text-white mb-2">Your wallet needs a tiny bit of SOL</p>
              <p className="text-sm text-white/60 mb-4 leading-relaxed">
                Solana charges a fraction of a cent per transaction. Your wallet{wallet?.address ? ` (${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)})` : ''} has none yet.
                {' '}On devnet it&apos;s free — grab some from the faucet below, then hit retry.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={wallet?.address ? `https://faucet.solana.com/?walletAddress=${wallet.address}&network=devnet` : 'https://faucet.solana.com/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-colors"
                >
                  Get devnet SOL →
                </a>
                <button
                  onClick={() => { setDeployStep(-1); setDeployError(null); }}
                  className="px-4 py-2 border border-white/20 text-white/70 text-xs hover:border-white/40 hover:text-white transition-colors"
                >
                  Back to form
                </button>
              </div>
            </div>
          )}

          {deployError && deployError !== 'NEEDS_SOL' && (
            <div className="mt-6 p-4 border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400 mb-4">{deployError}</p>
              <button
                onClick={() => { setDeployStep(-1); setDeployError(null); }}
                className="px-4 py-2 border border-white/20 text-white/60 text-xs hover:border-white/40 hover:text-white transition-colors"
              >
                Back to form
              </button>
            </div>
          )}

          {deploySuccess && (
            <p className="mt-6 text-sm text-white/40 font-mono">Redirecting to agent page...</p>
          )}
        </div>
      </main>
    );
  }

  const inputCls = "w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-emerald-400/60 transition-colors rounded-none";

  const hasRequiredKeys = !!apiKey;

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-xl mx-auto px-6 py-20 lg:py-28">
        <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3 font-mono">
          Launch a vault
        </h1>
        <p className="text-white/40 text-sm mb-10">
          Pick a template. Your agent starts earning from public chat immediately.
        </p>

        {/* Template picker */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTemplate(t.id);
                if (t.id !== 'custom') {
                  setSystemPrompt(t.prompt);
                  setPricePerCall(t.price);
                  setName(t.name);
                }
              }}
              className={`text-left p-4 border transition-colors ${
                selectedTemplate === t.id
                  ? 'border-emerald-400/60 bg-emerald-400/5'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              }`}
            >
              <div className="text-lg mb-1">{t.emoji}</div>
              <div className="text-sm text-white font-medium">{t.name}</div>
              <div className="text-xs text-white/40 mt-1">{t.desc}</div>
              {t.price > 0 && t.id !== 'custom' && (
                <div className="text-[10px] text-emerald-300/50 mt-2">${t.price}/msg</div>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            className={inputCls + " text-base resize-none"}
            placeholder="Every morning, read the latest AI news and post a 200 word summary to my Telegram."
          />
          {errors.systemPrompt && <p className="text-xs text-red-400 -mt-3">{errors.systemPrompt}</p>}

          <details className="border border-white/10 bg-white/[0.02]" open={!hasRequiredKeys}>
            <summary className="px-5 py-3 cursor-pointer text-xs text-white/60 hover:text-white flex items-center justify-between">
              <span>Setup {!hasRequiredKeys && <span className="text-red-400 ml-1">•</span>}</span>
              <span className="text-white/30">{hasRequiredKeys ? 'ready' : 'api key required'}</span>
            </summary>
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Agent name"
                />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>
              <div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={inputCls + " font-mono text-sm"}
                  placeholder="Anthropic API key (sk-ant-...)"
                />
                {errors.apiKey && <p className="text-xs text-red-400 mt-1">{errors.apiKey}</p>}
                <p className="text-xs text-white/30 mt-1">Required. Encrypted at rest.</p>
              </div>
            </div>
          </details>

          <details className="border border-white/10 bg-white/[0.02]">
            <summary className="px-5 py-3 cursor-pointer text-xs text-white/50 hover:text-white/70">
              Optional — Telegram, heartbeat, web search
            </summary>
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className={inputCls + " font-mono text-sm"}
                placeholder="Telegram bot token (from @BotFather)"
              />
              <input
                type="text"
                value={operatorTelegram}
                onChange={(e) => setOperatorTelegram(e.target.value.replace(/^@/, ''))}
                className={inputCls}
                placeholder="Your Telegram username"
              />
              <input
                type="password"
                value={braveApiKey}
                onChange={(e) => setBraveApiKey(e.target.value)}
                className={inputCls + " font-mono text-sm"}
                placeholder="Brave Search API key (enables web search)"
              />
              <label className="flex items-center gap-3 cursor-pointer text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={heartbeatEnabled}
                  onChange={(e) => setHeartbeatEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                Run periodically
              </label>
              {heartbeatEnabled && (
                <select
                  value={heartbeatInterval}
                  onChange={(e) => setHeartbeatInterval(e.target.value)}
                  className={inputCls + " font-mono text-sm"}
                >
                  <option value="15m">Every 15 min</option>
                  <option value="30m">Every 30 min</option>
                  <option value="1h">Every hour</option>
                  <option value="2h">Every 2 hours</option>
                </select>
              )}
            </div>
          </details>

          <button
            onClick={handleDeploy}
            disabled={isCreating || deployStep >= 0 || !systemPrompt.trim() || !apiKey}
            className="w-full py-4 bg-emerald-400 text-black text-sm font-bold hover:bg-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Deploying…' : 'Launch'}
          </button>
          {pricePerCall > 0 && (
            <p className="text-xs text-white/30 text-center mt-2">
              Public visitors will pay ${pricePerCall}/message · revenue goes to your wallet
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
