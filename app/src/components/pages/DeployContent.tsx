'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast, toastTx } from '@/lib/toast';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { deployOpenClaw, registerCustomAgent } from '@/lib/runtime';
import { useSetJobSigner } from '@/hooks/useSetJobSigner';
import { PublicKey } from '@solana/web3.js';
import WalletButton from '@/components/WalletButton';
import PriceInput from '@/components/create/PriceInput';

const EXPECTED_NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

type AgentType = 'openclaw' | 'custom';

const TABS: { type: AgentType; label: string; accent: string; accentBg: string; accentBorder: string }[] = [
  { type: 'openclaw', label: 'OpenClaw', accent: 'text-orange-500', accentBg: 'bg-orange-500', accentBorder: 'border-orange-500' },
  { type: 'custom', label: 'Custom', accent: 'text-violet-500', accentBg: 'bg-violet-500', accentBorder: 'border-violet-500' },
];

const TYPE_INFO: Record<AgentType, string> = {
  openclaw: 'Isolated container. Private subnet, no public IP, 256 CPU / 512 MB. ~$10/mo container cost. Bond: $1 USDC.',
  custom: 'External agent. Free to register. You run your own server and register your endpoint URL to accept x402 payments. Bond: $1 USDC.',
};

const DEFAULT_PRICES: Record<AgentType, number> = {
  openclaw: 0.10,
  custom: 0.05,
};

export default function DeployContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { setJobSigner } = useSetJobSigner();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [agentType, setAgentType] = useState<AgentType>('openclaw');
  const [name, setName] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [pricePerCall, setPricePerCall] = useState(DEFAULT_PRICES.openclaw);
  const [apiKey, setApiKey] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deploySteps, setDeploySteps] = useState<{ label: string; status: 'pending' | 'active' | 'done' | 'error'; detail?: string }[]>([]);
  const isDeploying = deploySteps.length > 0 && !deploySuccess;

  const tab = TABS.find(t => t.type === agentType)!;

  const handleTabChange = (type: AgentType) => {
    setAgentType(type);
    setPricePerCall(DEFAULT_PRICES[type]);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name || name.length < 3 || name.length > 50) {
      newErrors.name = 'Name must be 3-50 characters';
    }

    if (agentType !== 'custom') {
      if (!systemPrompt || systemPrompt.length < 10) {
        newErrors.systemPrompt = 'System prompt must be at least 10 characters';
      }
      if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        newErrors.apiKey = 'Valid Anthropic API key required (starts with sk-ant-)';
      }
    }

    if (agentType === 'custom') {
      if (!endpointUrl || !endpointUrl.startsWith('http')) {
        newErrors.endpointUrl = 'Valid endpoint URL required (https://...)';
      }
    }

    if (pricePerCall < 0.01 || pricePerCall > 1.0) {
      newErrors.pricePerCall = 'Price must be between $0.01 and $1.00';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateStep = (index: number, status: 'active' | 'done' | 'error', detail?: string) => {
    setDeploySteps(prev => prev.map((s, i) => i === index ? { ...s, status, detail: detail ?? s.detail } : s));
  };

  const handleDeploy = async () => {
    if (!validateForm()) return;

    if (!connected) {
      toast('Please connect your wallet to deploy an agent', 'error');
      return;
    }

    const agentWalletAddress = wallet?.address;
    if (!agentWalletAddress) {
      toast('Wallet address not available', 'error');
      return;
    }

    const isOC = agentType === 'openclaw';
    const steps = [
      { label: 'Creating vault & registry on-chain', status: 'pending' as const },
      { label: isOC ? 'Deploying container' : 'Registering endpoint', status: 'pending' as const },
      { label: 'Delegating job signer', status: 'pending' as const },
    ];
    setDeploySteps(steps);

    let vaultStr = '';

    try {
      // Step 1: On-chain
      updateStep(0, 'active');
      const runtimeBaseUrl = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001';
      const onChainEndpoint = agentType === 'custom' ? endpointUrl : runtimeBaseUrl;

      const result = await createAgent({
        name,
        githubHandle: githubHandle || 'blockhelix',
        endpointUrl: onChainEndpoint,
        agentFeeBps: 200,
        protocolFeeBps: 50,
        challengeWindow: 86400,
        maxTvl: 10_000_000,
        lockupEpochs: 1,
        epochLength: 86400,
        arbitrator: PROTOCOL_TREASURY.toString(),
      });

      vaultStr = result.vaultState.toString();
      updateStep(0, 'done', result.signature.slice(0, 8) + '...');

      // Step 2: Deploy container or register endpoint
      updateStep(1, 'active');
      const priceUsdcMicro = Math.floor(pricePerCall * 1_000_000);

      if (isOC) {
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
          signMessage: wallet.signMessage.bind(wallet),
        });
        updateStep(1, 'done', 'deploying async');

        // Step 3: Job signer (fire and forget before redirect)
        updateStep(2, 'active');
        try {
          const runtimeUrl = process.env.NEXT_PUBLIC_RUNTIME_URL ||
            (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
              ? 'https://agents.blockhelix.tech' : 'http://localhost:3001');
          const health = await fetch(`${runtimeUrl}/health`).then(r => r.json());
          if (health.kms?.publicKey) {
            await setJobSigner(new PublicKey(vaultStr), new PublicKey(health.kms.publicKey));
            updateStep(2, 'done');
          } else {
            updateStep(2, 'done', 'skipped');
          }
        } catch {
          updateStep(2, 'error', 'failed — set in Edit Agent');
        }

        router.push(`/agent/${vaultStr}`);
      } else {
        await registerCustomAgent({
          agentId: vaultStr,
          name,
          endpointUrl,
          priceUsdcMicro,
          agentWallet: agentWalletAddress,
          vault: vaultStr,
          ownerWallet: wallet?.address,
          signMessage: wallet.signMessage.bind(wallet),
        });
        updateStep(1, 'done');

        // Step 3: Job signer
        updateStep(2, 'active');
        try {
          const runtimeUrl = process.env.NEXT_PUBLIC_RUNTIME_URL ||
            (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
              ? 'https://agents.blockhelix.tech' : 'http://localhost:3001');
          const health = await fetch(`${runtimeUrl}/health`).then(r => r.json());
          if (health.kms?.publicKey) {
            await setJobSigner(new PublicKey(vaultStr), new PublicKey(health.kms.publicKey));
            updateStep(2, 'done');
          } else {
            updateStep(2, 'done', 'skipped');
          }
        } catch {
          updateStep(2, 'error', 'failed — set in Edit Agent');
        }

        setDeploySuccess(true);
        setTimeout(() => {
          router.push(`/agent/${vaultStr}`);
        }, 3000);
      }

    } catch (error: any) {
      console.error('Deploy error:', error);
      const failedIdx = deploySteps.findIndex(s => s.status === 'active');
      if (failedIdx >= 0) updateStep(failedIdx, 'error', error.message?.slice(0, 80));
      toast(error.message || 'Failed to create agent', 'error');
    }
  };

  if (!connected) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <p className={`text-[10px] uppercase tracking-widest ${tab.accent} mb-4`}>Create Agent</p>
          <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 font-mono">
            Create Agent
          </h1>
          <p className="text-lg text-white/60 mb-12 max-w-xl">
            Connect your wallet to create an agent on BlockHelix.
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

  if (deploySuccess) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <div className={`border ${tab.accentBorder} bg-white/5 p-12 text-center`}>
            <div className={`text-6xl mb-6 ${tab.accent}`}>&#10003;</div>
            <h2 className="text-3xl font-bold text-white mb-4 font-mono">Agent Created</h2>
            <p className="text-lg text-white/60">
              {agentType === 'openclaw'
                ? 'Your OpenClaw agent is running in an isolated container.'
                : 'Your custom agent endpoint has been registered.'}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-6 py-20 lg:py-32">
        <p className={`text-[10px] uppercase tracking-widest ${tab.accent} mb-4`}>Create Agent</p>
        <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4 font-mono">
          Create Agent
        </h1>
        <p className="text-white/50 mb-8 max-w-xl">
          Launch an agent on BlockHelix. Choose your deployment type below.
        </p>

        {EXPECTED_NETWORK === 'devnet' && (
          <div className={`mb-8 p-4 bg-white/5 border border-white/10 font-mono text-sm ${tab.accent}`}>
            <strong>Devnet Mode:</strong>{' '}
            <span className="text-white/60">Running on Solana devnet. Make sure you have devnet SOL.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {TABS.map(t => (
            <button
              key={t.type}
              onClick={() => handleTabChange(t.type)}
              className={`px-5 py-2.5 text-[10px] uppercase tracking-widest font-mono transition-colors border-b-2 ${
                agentType === t.type
                  ? `${t.accentBorder} text-white bg-white/5`
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Info box */}
        <div className="mb-8 p-4 border border-white/10 bg-white/5 text-sm text-white/70">
          {TYPE_INFO[agentType]}
        </div>

        {isDeploying && (
          <div className="mb-8 border border-white/10 bg-white/[0.02]">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-mono font-bold">DEPLOYING</span>
            </div>
            <div className="p-5 space-y-4">
              {deploySteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                    {step.status === 'active' && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                    {step.status === 'done' && <span className="text-emerald-400 text-sm">&#10003;</span>}
                    {step.status === 'error' && <span className="text-red-400 text-sm">&#10007;</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-mono ${
                      step.status === 'active' ? 'text-cyan-400' :
                      step.status === 'done' ? 'text-white/60' :
                      step.status === 'error' ? 'text-red-400' :
                      'text-white/30'
                    }`}>
                      {step.label}
                      {step.status === 'active' && <span className="animate-pulse">...</span>}
                    </span>
                    {step.detail && (
                      <span className="ml-2 text-xs text-white/30 font-mono">{step.detail}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {deploySuccess && (
              <div className="px-5 py-3 border-t border-emerald-400/20 bg-emerald-400/5">
                <span className="text-sm text-emerald-400 font-mono">Redirecting to agent page...</span>
              </div>
            )}
          </div>
        )}

        <div className={`space-y-8 ${isDeploying ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="space-y-6 pb-12 border-b border-white/10">
            {/* Name */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                placeholder="Research Assistant"
              />
              {errors.name && <p className="text-xs text-red-400 mt-1 font-mono">{errors.name}</p>}
            </div>

            {/* GitHub Handle */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                GitHub Handle
              </label>
              <input
                type="text"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                placeholder="blockhelix"
              />
            </div>

            {/* System Prompt (Standard / OpenClaw) */}
            {agentType !== 'custom' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                  System Prompt *
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="You are a research assistant specialized in..."
                />
                {errors.systemPrompt && <p className="text-xs text-red-400 mt-1 font-mono">{errors.systemPrompt}</p>}
                <p className="text-xs text-white/30 mt-2 font-mono">
                  Tip: Be specific. Good prompts make good agents.
                </p>
              </div>
            )}

            {/* API Key (Standard / OpenClaw) */}
            {agentType !== 'custom' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                  Anthropic API Key *
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="sk-ant-..."
                />
                {errors.apiKey && <p className="text-xs text-red-400 mt-1 font-mono">{errors.apiKey}</p>}
                <p className="text-xs text-white/30 mt-2 font-mono">
                  Your key is passed to the container at deploy time. Platform never stores it.
                </p>
              </div>
            )}

            {/* Endpoint URL (Custom) */}
            {agentType === 'custom' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="https://your-server.com/v1/agent/run"
                />
                {errors.endpointUrl && <p className="text-xs text-red-400 mt-1 font-mono">{errors.endpointUrl}</p>}
                <p className="text-xs text-white/30 mt-2 font-mono">
                  Your server must accept x402 payment headers. See docs for the expected API format.
                </p>
              </div>
            )}

            {/* Price */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2 font-mono">
                Price per call *
              </label>
              <PriceInput value={pricePerCall} onChange={setPricePerCall} dark />
              {errors.pricePerCall && <p className="text-xs text-red-400 mt-1 font-mono">{errors.pricePerCall}</p>}
            </div>
          </div>

          {/* Bond info */}
          <div className="p-4 border border-white/10 bg-white/5 text-sm text-white/60">
            <span className="text-white font-mono font-semibold">$1 USDC</span> bond required.
            Posted on-chain as operator stake. Slashed 2x for misbehavior.
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleDeploy}
              disabled={isCreating || isDeploying}
              className={`px-8 py-4 ${tab.accentBg} text-black text-[10px] uppercase tracking-widest font-mono font-bold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
            >
              {isCreating || isDeploying ? 'Deploying...' : (
                <>
                  {agentType === 'custom' ? 'Register' : 'Create'} Agent <span>&rarr;</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
