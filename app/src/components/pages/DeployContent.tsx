'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast } from '@/lib/toast';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { registerAgentWithRuntime, deployOpenClaw, registerCustomAgent } from '@/lib/runtime';
import WalletButton from '@/components/WalletButton';
import TestAgentPanel from '@/components/create/TestAgentPanel';
import PriceInput from '@/components/create/PriceInput';

const EXPECTED_NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

type AgentType = 'standard' | 'openclaw' | 'custom';

const TABS: { type: AgentType; label: string; accent: string; accentBg: string; accentBorder: string }[] = [
  { type: 'standard', label: 'Standard', accent: 'text-cyan-500', accentBg: 'bg-cyan-500', accentBorder: 'border-cyan-500' },
  { type: 'openclaw', label: 'OpenClaw', accent: 'text-orange-500', accentBg: 'bg-orange-500', accentBorder: 'border-orange-500' },
  { type: 'custom', label: 'Custom', accent: 'text-violet-500', accentBg: 'bg-violet-500', accentBorder: 'border-violet-500' },
];

const TYPE_INFO: Record<AgentType, string> = {
  standard: 'Hosted inference. Free to create. You provide the prompt and API key, we run it. Bond: $1 USDC.',
  openclaw: 'Isolated container. Private subnet, no public IP, 256 CPU / 512 MB. ~$10/mo container cost. Bond: $1 USDC.',
  custom: 'External agent. Free to register. You run your own server and register your endpoint URL to accept x402 payments. Bond: $1 USDC.',
};

const DEFAULT_PRICES: Record<AgentType, number> = {
  standard: 0.05,
  openclaw: 0.10,
  custom: 0.05,
};

export default function DeployContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();
  const searchParams = useSearchParams();

  const getInitialType = (): AgentType => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'openclaw' || typeParam === 'custom' || typeParam === 'standard') {
      return typeParam;
    }
    return 'standard';
  };

  const [agentType, setAgentType] = useState<AgentType>(getInitialType);
  const [name, setName] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [pricePerCall, setPricePerCall] = useState(DEFAULT_PRICES[getInitialType()]);
  const [apiKey, setApiKey] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tab = TABS.find(t => t.type === agentType)!;

  const handleTabChange = (type: AgentType) => {
    setAgentType(type);
    setPricePerCall(DEFAULT_PRICES[type]);
    setErrors({});
    setIsTestMode(false);
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

  const handleDeploy = async () => {
    if (!validateForm()) return;

    if (!connected) {
      toast('Please connect your wallet to deploy an agent', 'error');
      return;
    }

    try {
      toast('Creating agent on-chain...', 'info');

      const runtimeBaseUrl = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001';
      const agentWalletAddress = wallet?.address;

      if (!agentWalletAddress) {
        throw new Error('Wallet address not available');
      }

      const onChainEndpoint = agentType === 'custom'
        ? endpointUrl
        : runtimeBaseUrl;

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

      const priceUsdcMicro = Math.floor(pricePerCall * 1_000_000);
      const vaultStr = result.vaultState.toString();

      if (agentType === 'standard') {
        toast('Agent created on-chain! Registering with runtime...', 'success');
        try {
          await registerAgentWithRuntime({
            agentId: agentWalletAddress,
            name,
            systemPrompt,
            priceUsdcMicro,
            agentWallet: agentWalletAddress,
            vault: vaultStr,
            registry: '',
            apiKey,
            ownerWallet: wallet?.address,
          });
          toast('Agent registered with runtime!', 'success');
        } catch (runtimeError: any) {
          console.error('Runtime registration error:', runtimeError);
          toast(`Warning: Agent created on-chain but runtime registration failed: ${runtimeError.message}`, 'info');
        }
      } else if (agentType === 'openclaw') {
        toast('On-chain creation complete! Starting container...', 'success');
        await deployOpenClaw({
          agentId: agentWalletAddress,
          name,
          systemPrompt,
          priceUsdcMicro,
          operator: agentWalletAddress,
          vault: vaultStr,
          registry: '',
          apiKey,
          ownerWallet: wallet?.address,
        });
        toast('OpenClaw agent deployed in isolated container!', 'success');
      } else {
        toast('On-chain creation complete! Registering endpoint...', 'success');
        await registerCustomAgent({
          agentId: agentWalletAddress,
          name,
          endpointUrl,
          priceUsdcMicro,
          agentWallet: agentWalletAddress,
          vault: vaultStr,
          ownerWallet: wallet?.address,
        });
        toast('Custom agent registered!', 'success');
      }

      setDeploySuccess(true);
      setTimeout(() => {
        router.push(`/agent/${vaultStr}`);
      }, 1500);

    } catch (error: any) {
      console.error('Deploy error:', error);
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
                : agentType === 'custom'
                  ? 'Your custom agent endpoint has been registered.'
                  : 'Your agent is now live and ready to accept calls.'}
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

        <div className="space-y-8">
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
                  {agentType === 'openclaw'
                    ? 'Your key is passed to the container at deploy time. Platform never stores it.'
                    : 'Get your key from console.anthropic.com. You pay Claude directly for usage.'}
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
            {agentType === 'standard' && (
              <button
                onClick={() => {
                  if (validateForm()) setIsTestMode(!isTestMode);
                }}
                className="px-6 py-3 border border-white/20 text-white/70 text-[10px] uppercase tracking-widest font-mono hover:bg-white/5 transition-colors"
              >
                {isTestMode ? 'Hide Test' : 'Test Agent'}
              </button>
            )}
            <button
              onClick={handleDeploy}
              disabled={isCreating}
              className={`px-8 py-4 ${tab.accentBg} text-black text-[10px] uppercase tracking-widest font-mono font-bold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
            >
              {isCreating ? 'Creating...' : (
                <>
                  {agentType === 'custom' ? 'Register' : 'Create'} Agent <span>&rarr;</span>
                </>
              )}
            </button>
          </div>

          {isTestMode && agentType === 'standard' && (
            <TestAgentPanel
              systemPrompt={systemPrompt}
              name={name}
              apiKey={apiKey}
            />
          )}
        </div>
      </div>
    </main>
  );
}
