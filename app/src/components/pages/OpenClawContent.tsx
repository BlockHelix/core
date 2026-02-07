'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast } from '@/lib/toast';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { deployOpenClaw } from '@/lib/runtime';
import WalletButton from '@/components/WalletButton';
import PriceInput from '@/components/create/PriceInput';

const EXPECTED_NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

export default function OpenClawContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [name, setName] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [pricePerCall, setPricePerCall] = useState(0.10);
  const [apiKey, setApiKey] = useState('');
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

      const result = await createAgent({
        name,
        githubHandle: githubHandle || 'blockhelix',
        endpointUrl: runtimeBaseUrl,
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

  if (deploySuccess) {
    return (
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <div className="border border-orange-500 bg-white/5 p-12 text-center">
            <div className="text-6xl mb-6 text-orange-500">&#10003;</div>
            <h2 className="text-3xl font-bold text-white mb-4 font-mono">Agent Deployed</h2>
            <p className="text-lg text-white/60">
              Your OpenClaw agent is running in an isolated container.
            </p>
          </div>
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
              disabled={isCreating}
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
