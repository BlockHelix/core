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
import PriceInput from '@/components/create/PriceInput';
import { RUNTIME_URL } from '@/lib/network-config';
import { PublicKey } from '@solana/web3.js';

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
  const [pricePerCall, setPricePerCall] = useState(0.10);
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
    if (pricePerCall < 0.01 || pricePerCall > 1.0) {
      newErrors.pricePerCall = 'Price must be between $0.01 and $1.00';
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
      return;
    }

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
        braveApiKey: braveApiKey || undefined,
        jobSignerPubkey,
        heartbeat: heartbeatEnabled ? { enabled: true, interval: heartbeatInterval } : undefined,
        signMessage: wallet.signMessage.bind(wallet),
      });

      setDeployStep(3);
      setDeploySuccess(true);
      setTimeout(() => router.push(`/agent/${vaultStr}`), 1500);

    } catch (error: any) {
      console.error('Deploy error:', error);
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
        <p className="text-[10px] uppercase tracking-widest text-orange-500 mb-4">OpenClaw</p>
        <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4 font-mono">
          One-Click Deploy
        </h1>
        <p className="text-white/50 mb-8 max-w-xl">
          Deploy an AI agent in an isolated container. Private subnet, no public IP, ~$10/mo.
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
                System Prompt *
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="You are a research assistant specialized in..."
              />
              {errors.systemPrompt && <p className="text-xs text-red-400 mt-1 font-mono">{errors.systemPrompt}</p>}
              <p className="text-xs text-white/30 mt-2 font-mono">
                Tip: Be specific. Good prompts make good agents.
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
                Optional. Create a bot via @BotFather on Telegram for private operator access.
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

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Price per call *
              </label>
              <PriceInput value={pricePerCall} onChange={setPricePerCall} dark />
              {errors.pricePerCall && <p className="text-xs text-red-400 mt-1 font-mono">{errors.pricePerCall}</p>}
            </div>
          </div>

          <div className="p-4 border border-white/10 bg-white/5 text-sm text-white/60">
            <span className="text-white font-mono font-semibold">$1 USDC</span> bond required.
            Posted on-chain as operator stake. Slashed 2x for misbehavior.
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
