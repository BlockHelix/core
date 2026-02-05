'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast } from '@/lib/toast';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { registerAgentWithRuntime } from '@/lib/runtime';
import WalletButton from '@/components/WalletButton';
import TestAgentPanel from '@/components/create/TestAgentPanel';
import PriceInput from '@/components/create/PriceInput';

export default function CreateContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [pricePerCall, setPricePerCall] = useState(0.05);
  const [isTestMode, setIsTestMode] = useState(false);
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

    if (pricePerCall < 0.01 || pricePerCall > 1.0) {
      newErrors.pricePerCall = 'Price must be between $0.01 and $1.00';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeploy = async () => {
    if (!validateForm()) {
      return;
    }

    if (!connected) {
      toast('Please connect your wallet to deploy an agent', 'error');
      return;
    }

    try {
      toast('Deploying agent on-chain...', 'info');

      const runtimeBaseUrl = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001';
      const agentWalletAddress = wallet?.address;

      if (!agentWalletAddress) {
        throw new Error('Wallet address not available');
      }

      const result = await createAgent({
        name,
        githubHandle: githubHandle || 'blockhelix',
        endpointUrl: `${runtimeBaseUrl}/v1/agent/${agentWalletAddress}/run`,
        agentFeeBps: 200,
        protocolFeeBps: 50,
        challengeWindow: 86400,
        maxTvl: 10_000_000,
        lockupEpochs: 1,
        epochLength: 86400,
        targetApyBps: 1000,
        lendingFloorBps: 300,
        arbitrator: PROTOCOL_TREASURY.toString(),
      });

      toast('Agent deployed on-chain! Registering with runtime...', 'success');

      try {
        const priceUsdcMicro = Math.floor(pricePerCall * 1_000_000);

        await registerAgentWithRuntime({
          agentId: agentWalletAddress,
          name,
          systemPrompt,
          priceUsdcMicro,
          agentWallet: agentWalletAddress,
          vault: result.vaultState.toString(),
          registry: '',
        });

        toast('Agent registered with runtime!', 'success');
      } catch (runtimeError: any) {
        console.error('Runtime registration error:', runtimeError);
        toast(`Warning: Agent created on-chain but runtime registration failed: ${runtimeError.message}`, 'warning');
      }

      setDeploySuccess(true);

      setTimeout(() => {
        router.push(`/agent/${result.vaultState.toString()}`);
      }, 1500);

    } catch (error: any) {
      console.error('Deploy error:', error);
      toast(error.message || 'Failed to deploy agent', 'error');
    }
  };

  if (!connected) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Create Agent</p>
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 font-mono">
            Deploy Your Agent
          </h1>
          <p className="text-lg text-gray-500 mb-12 max-w-xl">
            Connect your wallet to create a hosted inference agent. Set your prompt, price, and start earning from every call.
          </p>

          <div className="border border-gray-200 bg-gray-50 p-12 text-center">
            <p className="text-sm text-gray-500 mb-6 uppercase tracking-widest">
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
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <div className="border border-emerald-500 bg-emerald-50 p-12 text-center">
            <div className="text-6xl mb-6">✓</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 font-mono">Agent Deployed</h2>
            <p className="text-lg text-gray-600">
              Your agent is now live and ready to accept calls.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-20 lg:py-32">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Create Agent</p>
        <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-16 font-mono">
          Create Agent
        </h1>

        <div className="space-y-8">
          <div className="space-y-6 pb-12 border-b border-gray-200">
            <div>
              <label htmlFor="name" className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-mono">
                Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="Research Assistant"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1 font-mono">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="githubHandle" className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-mono">
                GitHub Handle
              </label>
              <input
                type="text"
                id="githubHandle"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="blockhelix"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-mono">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 resize-none focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="What does your agent do?"
              />
            </div>

            <div>
              <label htmlFor="systemPrompt" className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-mono">
                System Prompt * (this is your alpha)
              </label>
              <textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 font-mono text-sm resize-none focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="You are a research assistant specialized in..."
              />
              {errors.systemPrompt && (
                <p className="text-xs text-red-600 mt-1 font-mono">{errors.systemPrompt}</p>
              )}
              <p className="text-xs text-gray-400 mt-2 font-mono">
                Tip: Be specific. Good prompts make good agents.
              </p>
            </div>

            <div>
              <label htmlFor="price" className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-mono">
                Price per call *
              </label>
              <PriceInput value={pricePerCall} onChange={setPricePerCall} />
              {errors.pricePerCall && (
                <p className="text-xs text-red-600 mt-1 font-mono">{errors.pricePerCall}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (validateForm()) {
                  setIsTestMode(!isTestMode);
                }
              }}
              className="px-6 py-3 border border-gray-900 text-gray-900 text-[10px] uppercase tracking-widest font-mono hover:bg-gray-50 transition-colors"
            >
              {isTestMode ? 'Hide Test' : 'Test Agent'}
            </button>
            <button
              onClick={handleDeploy}
              disabled={isCreating}
              className="px-6 py-3 bg-gray-900 text-white text-[10px] uppercase tracking-widest font-mono hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? 'Deploying...' : (
                <>
                  Deploy Agent <span>→</span>
                </>
              )}
            </button>
          </div>

          {isTestMode && (
            <TestAgentPanel
              systemPrompt={systemPrompt}
              name={name}
            />
          )}
        </div>
      </div>
    </main>
  );
}
