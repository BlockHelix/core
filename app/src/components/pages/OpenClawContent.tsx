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
  const githubHandle = 'blockhelix';
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

  const inputCls = "w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-emerald-400/60 transition-colors rounded-none";

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-xl mx-auto px-6 py-20 lg:py-28">
        <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3 font-mono">
          New agent
        </h1>
        <p className="text-white/50 mb-10 text-base">
          It&apos;ll run in the cloud, pay for tools as it works, and ping you on Telegram before big spends.
        </p>

        <div className="space-y-6">
          {/* What is it called */}
          <div>
            <label className="block text-xs text-white/60 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="My research agent"
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>

          {/* What should it do */}
          <div>
            <label className="block text-xs text-white/60 mb-2">
              What should it do?
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className={inputCls + " font-mono text-sm resize-none"}
              placeholder={'e.g. "Every morning, research the latest AI agent news, summarize the top 5 items, and post to my Telegram. Keep it under 300 words."'}
            />
            {errors.systemPrompt && <p className="text-xs text-red-400 mt-1">{errors.systemPrompt}</p>}
          </div>

          {/* Telegram */}
          <div>
            <label className="block text-xs text-white/60 mb-2">
              Your Telegram username
            </label>
            <input
              type="text"
              value={operatorTelegram}
              onChange={(e) => setOperatorTelegram(e.target.value.replace(/^@/, ''))}
              className={inputCls}
              placeholder="satoshi"
            />
            {errors.operatorTelegram && <p className="text-xs text-red-400 mt-1">{errors.operatorTelegram}</p>}
            <p className="text-xs text-white/40 mt-2">
              Your agent will DM you here for approvals and updates.
            </p>
          </div>

          {/* Keys — compact block */}
          <div className="border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <p className="text-xs text-white/60">Keys</p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={inputCls + " font-mono text-sm"}
              placeholder="Anthropic API key (sk-ant-...)"
            />
            {errors.apiKey && <p className="text-xs text-red-400 -mt-2">{errors.apiKey}</p>}
            <input
              type="password"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              className={inputCls + " font-mono text-sm"}
              placeholder="Telegram bot token (from @BotFather)"
            />
            <p className="text-xs text-white/30">
              Encrypted at rest. You pay Anthropic directly.
            </p>
          </div>

          {/* Advanced — collapsed by default */}
          <details className="border border-white/10 bg-white/[0.02]">
            <summary className="px-5 py-3 cursor-pointer text-xs text-white/50 hover:text-white/70 transition-colors">
              Advanced
            </summary>
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              <div>
                <label className="block text-xs text-white/50 mb-2">
                  Approval threshold (USDC)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={approvalThresholdUsdc}
                  onChange={(e) => setApprovalThresholdUsdc(parseFloat(e.target.value) || 0)}
                  className={inputCls + " font-mono text-sm"}
                />
                <p className="text-xs text-white/30 mt-1">
                  Spends over this amount need your approval on Telegram.
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2">
                  Brave Search API key
                </label>
                <input
                  type="password"
                  value={braveApiKey}
                  onChange={(e) => setBraveApiKey(e.target.value)}
                  className={inputCls + " font-mono text-sm"}
                  placeholder="Optional — enables web search"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={heartbeatEnabled}
                  onChange={(e) => setHeartbeatEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                Run periodically (heartbeat)
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
            disabled={isCreating || deployStep >= 0}
            className="w-full py-4 bg-emerald-400 text-black text-sm font-bold hover:bg-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Deploying…' : 'Launch agent'}
          </button>
        </div>
      </div>
    </main>
  );
}
