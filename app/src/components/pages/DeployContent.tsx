'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast } from '@/lib/toast';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { registerCustomAgent } from '@/lib/runtime';
import { useSetJobSigner } from '@/hooks/useSetJobSigner';
import { PublicKey } from '@solana/web3.js';
import WalletButton from '@/components/WalletButton';
import PriceInput from '@/components/create/PriceInput';

const EXPECTED_NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

const ACCENT = 'text-violet-500';
const ACCENT_BG = 'bg-violet-500';
const ACCENT_BORDER = 'border-violet-500';
const TYPE_INFO = 'External agent. Free to register. You run your own server and register your endpoint URL to accept x402 payments. Bond: $1 USDC.';

export default function DeployContent() {
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading: isCreating } = useCreateAgent();
  const { setJobSigner } = useSetJobSigner();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [name, setName] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [pricePerCall, setPricePerCall] = useState(0.05);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deploySteps, setDeploySteps] = useState<{ label: string; status: 'pending' | 'active' | 'done' | 'error'; detail?: string }[]>([]);
  const isDeploying = deploySteps.length > 0 && !deploySuccess;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name || name.length < 3 || name.length > 50) {
      newErrors.name = 'Name must be 3-50 characters';
    }

    if (!endpointUrl || !endpointUrl.startsWith('http')) {
      newErrors.endpointUrl = 'Valid endpoint URL required (https://...)';
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

    const steps = [
      { label: 'Creating vault & registry on-chain', status: 'pending' as const },
      { label: 'Registering endpoint', status: 'pending' as const },
      { label: 'Delegating job signer', status: 'pending' as const },
    ];
    setDeploySteps(steps);

    let vaultStr = '';

    try {
      // Step 1: On-chain
      updateStep(0, 'active');

      const result = await createAgent({
        name,
        githubHandle: githubHandle || 'blockhelix',
        endpointUrl,
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

      // Step 2: Register endpoint
      updateStep(1, 'active');
      const priceUsdcMicro = Math.floor(pricePerCall * 1_000_000);

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
          <p className={`text-[10px] uppercase tracking-widest ${ACCENT} mb-4`}>Create Agent</p>
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
          <div className={`border ${ACCENT_BORDER} bg-white/5 p-12 text-center`}>
            <div className={`text-6xl mb-6 ${ACCENT}`}>&#10003;</div>
            <h2 className="text-3xl font-bold text-white mb-4 font-mono">Agent Created</h2>
            <p className="text-lg text-white/60">
              Your custom agent endpoint has been registered.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-6 py-20 lg:py-32">
        <p className={`text-[10px] uppercase tracking-widest ${ACCENT} mb-4`}>Create Agent</p>
        <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4 font-mono">
          Create Agent
        </h1>
        <p className="text-white/50 mb-8 max-w-xl">
          Register your own agent endpoint on BlockHelix to accept x402 payments.
        </p>

        {EXPECTED_NETWORK === 'devnet' && (
          <div className={`mb-8 p-4 bg-white/5 border border-white/10 font-mono text-sm ${ACCENT}`}>
            <strong>Devnet Mode:</strong>{' '}
            <span className="text-white/60">Running on Solana devnet. Make sure you have devnet SOL.</span>
          </div>
        )}

        {/* Info box */}
        <div className="mb-8 p-4 border border-white/10 bg-white/5 text-sm text-white/70">
          {TYPE_INFO}
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

            {/* Endpoint URL */}
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
              className={`px-8 py-4 ${ACCENT_BG} text-black text-[10px] uppercase tracking-widest font-mono font-bold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
            >
              {isCreating || isDeploying ? 'Deploying...' : (
                <>Register Agent <span>&rarr;</span></>
              )}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
