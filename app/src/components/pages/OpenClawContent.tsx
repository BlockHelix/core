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

export default function OpenClawContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { setJobSigner } = useSetJobSigner();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [name, setName] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const pricePerCall = 0;
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

    if (!name || name.length < 3 || name.length > 50) {
      newErrors.name = 'Name must be 3-50 characters';
    }
    if (!systemPrompt || systemPrompt.length < 10) {
      newErrors.systemPrompt = 'System prompt must be at least 10 characters';
    }
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      newErrors.apiKey = 'Valid Anthropic API key required (starts with sk-ant-)';
    }
    if (budgetUsdc < 1) {
      newErrors.budgetUsdc = 'Budget must be at least $1';
    }
    if (!operatorTelegram || operatorTelegram.length < 3) {
      newErrors.operatorTelegram = 'Telegram username required for approvals';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
        name,
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
        name,
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
      posthog?.capture('deploy_failed', { error: error.message, step: deployStep });
      setDeployError(error.message || 'Deployment failed');
    }
  };

  if (!connected) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <p className="text-[10px] uppercase tracking-widest text-orange-500 mb-4">OpenClaw</p>
          <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 font-mono">
            One-Click Deploy
          </h1>
          <p className="text-lg text-white/60 mb-12 max-w-xl">
            Launch AI agents in isolated containers. No infrastructure needed.
          </p>
          <div className="border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-sm text-white/50 mb-6 uppercase tracking-widest">
              Wallet Required
            </p>
            <WalletButton />
          </div>
        </div>
      </main>
    );
  }

  if (deployStep >= 0) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <p className="text-[10px] uppercase tracking-widest text-orange-500 mb-4">OpenClaw</p>
          <h2 className="text-3xl font-bold text-white mb-8 font-mono">
            {deploySuccess ? 'Agent Deployed' : 'Deploying Agent'}
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

          {deployError && (
            <div className="mt-6 p-4 border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400 font-mono mb-4">{deployError}</p>
              <button
                onClick={() => { setDeployStep(-1); setDeployError(null); }}
                className="px-6 py-2 border border-white/20 text-white/60 text-[10px] uppercase tracking-widest font-mono hover:border-white/40 hover:text-white transition-colors"
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

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-6 py-20 lg:py-32">
        <p className="text-[10px] uppercase tracking-widest text-orange-500 mb-4">Deploy Agent</p>
        <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4 font-mono">
          Give your agent<br />a wallet &amp; a task.
        </h1>
        <p className="text-white/50 mb-8 max-w-xl">
          Your agent runs in an isolated container, pays for tools as it works,
          and asks you on Telegram before spending above your threshold.
        </p>

        {EXPECTED_NETWORK === 'devnet' && (
          <div className="mb-8 p-4 bg-white/5 border border-white/10 font-mono text-sm text-orange-500">
            <strong>Devnet Mode:</strong>{' '}
            <span className="text-white/60">Running on Solana devnet. Make sure you have devnet SOL.</span>
          </div>
        )}

        <div className="space-y-8">
          <div className="space-y-6 pb-12 border-b border-white/10">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="Research Assistant"
              />
              {errors.name && <p className="text-xs text-red-400 mt-1 font-mono">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                GitHub Handle
              </label>
              <input
                type="text"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="blockhelix"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Task description *
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="Monitor these twitter accounts, summarize anything about X, post to my telegram daily..."
              />
              {errors.systemPrompt && <p className="text-xs text-red-400 mt-1 font-mono">{errors.systemPrompt}</p>}
              <p className="text-xs text-white/30 mt-2 font-mono">
                What should your agent do? Be specific. The agent will read this as its system prompt.
              </p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Anthropic API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="sk-ant-..."
              />
              {errors.apiKey && <p className="text-xs text-red-400 mt-1 font-mono">{errors.apiKey}</p>}
              <p className="text-xs text-white/30 mt-2 font-mono">
                Your key is encrypted at rest. You pay Claude directly for usage.
              </p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Telegram Bot Token
              </label>
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="123456:ABC-DEF..."
              />
              <p className="text-xs text-white/30 mt-2 font-mono">
                Required for approvals and operator chat. Create a bot via @BotFather on Telegram.
              </p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Your Telegram username
              </label>
              <input
                type="text"
                value={operatorTelegram}
                onChange={(e) => setOperatorTelegram(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="xwsch"
              />
              <p className="text-xs text-white/30 mt-2 font-mono">
                Without @. You&apos;ll receive approval requests here. Reply <span className="text-emerald-400">YES 42</span> or <span className="text-red-400">NO 42</span>.
              </p>
            </div>

            <div className="border border-emerald-500/20 bg-emerald-500/[0.03] p-5 space-y-5">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono font-bold">
                Budget &amp; Approvals
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                    Task budget (USDC)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={budgetUsdc}
                    onChange={(e) => setBudgetUsdc(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                    Approval threshold (USDC)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={approvalThresholdUsdc}
                    onChange={(e) => setApprovalThresholdUsdc(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                    placeholder="5"
                  />
                </div>
              </div>
              <p className="text-xs text-white/40 font-mono leading-relaxed">
                Total USDC your agent can spend on tools, APIs, and services.
                Spends above the threshold will message you on Telegram for approval.
                Fund the agent&apos;s wallet with this amount after deploy — it&apos;s the hard cap.
              </p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Brave Search API Key
              </label>
              <input
                type="password"
                value={braveApiKey}
                onChange={(e) => setBraveApiKey(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="BSA..."
              />
              <p className="text-xs text-white/30 mt-2 font-mono">
                Optional. Enables web search tool. Get one from brave.com/search/api.
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.02] p-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={heartbeatEnabled}
                  onChange={(e) => setHeartbeatEnabled(e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-mono">
                  Enable Heartbeat
                </span>
              </label>
              {heartbeatEnabled && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                    Interval
                  </label>
                  <select
                    value={heartbeatInterval}
                    onChange={(e) => setHeartbeatInterval(e.target.value)}
                    className="bg-white/5 border border-white/10 px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="15m">Every 15 min</option>
                    <option value="30m">Every 30 min</option>
                    <option value="1h">Every hour</option>
                    <option value="2h">Every 2 hours</option>
                  </select>
                  <p className="text-xs text-white/30 mt-2 font-mono">
                    Agent wakes up periodically to check tasks. Uses Haiku to minimize cost (~$0.01/check).
                  </p>
                </div>
              )}
            </div>

          </div>

          <div className="p-4 border border-white/10 bg-white/5 text-sm text-white/60 font-mono">
            After deploy, fund your agent&apos;s wallet with <span className="text-white font-semibold">${budgetUsdc} USDC</span>.
            That&apos;s the hard cap. Spends above <span className="text-emerald-400">${approvalThresholdUsdc}</span> require your approval.
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleDeploy}
              disabled={isCreating || deployStep >= 0}
              className="px-8 py-4 bg-orange-500 text-black text-[10px] uppercase tracking-widest font-mono font-bold hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? 'Deploying...' : (
                <>
                  Deploy Agent <span>&rarr;</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
