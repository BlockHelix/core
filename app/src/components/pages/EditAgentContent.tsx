'use client';

import { useAuth } from '@/hooks/useAuth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { getAgentDetail, updateAgentConfig, type AgentDetail } from '@/lib/runtime';
import { formatUSDC } from '@/lib/format';
import { toast } from '@/lib/toast';
import { CopyButton } from '@/components/CopyButton';
import WalletButton from '@/components/WalletButton';
import PriceInput from '@/components/create/PriceInput';
import bs58 from 'bs58';

interface EditAgentContentProps {
  agentId: string;
}

export default function EditAgentContent({ agentId }: EditAgentContentProps) {
  const { authenticated: connected } = useAuth();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const router = useRouter();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [pricePerCall, setPricePerCall] = useState(0.1);
  const [isActive, setIsActive] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!connected || !wallet?.address) {
      setIsLoading(false);
      return;
    }

    const fetchAgent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAgentDetail(agentId, wallet.address);
        setAgent(data);
        setSystemPrompt(data.systemPrompt);
        setPricePerCall(data.priceUsdcMicro / 1_000_000);
        setIsActive(data.isActive);
      } catch (err: any) {
        console.error('Failed to fetch agent:', err);
        setError(err.message || 'Failed to load agent');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, [agentId, connected, wallet?.address]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!systemPrompt || systemPrompt.length < 10) {
      newErrors.systemPrompt = 'System prompt must be at least 10 characters';
    }

    if (pricePerCall < 0.01 || pricePerCall > 1.0) {
      newErrors.pricePerCall = 'Price must be between $0.01 and $1.00';
    }

    if (apiKey && !apiKey.startsWith('sk-ant-')) {
      newErrors.apiKey = 'Valid Anthropic API key required (starts with sk-ant-)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!connected || !wallet?.address) {
      toast('Please connect your wallet', 'error');
      return;
    }

    if (!agent) {
      toast('Agent not loaded', 'error');
      return;
    }

    if (agent.ownerWallet !== wallet.address) {
      toast('You are not the owner of this agent', 'error');
      return;
    }

    try {
      setIsSaving(true);

      const updates: any = {
        systemPrompt,
        priceUsdcMicro: Math.floor(pricePerCall * 1_000_000),
        isActive,
      };

      if (apiKey) {
        updates.apiKey = apiKey;
      }

      await updateAgentConfig({
        agentId,
        wallet: wallet.address,
        signMessage: async (message: string) => {
          const encodedMessage = new TextEncoder().encode(message);
          const signedMessage = await wallet.signMessage({
            message: encodedMessage,
          });
          return signedMessage.signature;
        },
        updates,
      });

      toast('Agent configuration updated!', 'success');

      setTimeout(() => {
        router.push('/dashboard/operator');
      }, 1500);
    } catch (err: any) {
      console.error('Save error:', err);
      toast(err.message || 'Failed to update agent', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!connected) {
    return (
      <main className="min-h-screen py-32 lg:py-48">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6 font-mono">
              EDIT AGENT
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6 font-mono">
              Configure Agent
            </h1>
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-16">
              Update system prompt, API key, and pricing
            </p>

            <div className="border border-white/10 p-16 text-center bg-white/[0.02]">
              <p className="text-lg text-white/60 mb-10">
                Connect wallet to edit agent
              </p>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="space-y-8">
            <div className="h-12 skeleton w-1/2"></div>
            <div className="h-6 skeleton w-3/4"></div>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 skeleton"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="border border-red-500/20 bg-red-500/5 p-8">
            <h2 className="text-lg font-bold text-red-400 mb-2 font-mono">
              ERROR
            </h2>
            <p className="text-sm text-red-400/70">
              {error || 'Agent not found'}
            </p>
            <Link href="/dashboard/operator" className="inline-block mt-6">
              <button className="text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors duration-300">
                ← BACK TO DASHBOARD
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (agent.ownerWallet !== wallet?.address) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="border border-red-500/20 bg-red-500/5 p-8">
            <h2 className="text-lg font-bold text-red-400 mb-2 font-mono">
              UNAUTHORIZED
            </h2>
            <p className="text-sm text-red-400/70">
              You do not own this agent
            </p>
            <Link href="/dashboard/operator" className="inline-block mt-6">
              <button className="text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors duration-300">
                ← BACK TO DASHBOARD
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/dashboard/operator">
            <button className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors duration-300 mb-8 font-mono">
              <ArrowLeft className="w-4 h-4" />
              BACK TO DASHBOARD
            </button>
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-mono">
            EDIT AGENT
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            {agent.name}
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-12">
            Update configuration for your deployed agent
          </p>

          <div className="mb-8 border border-white/10 p-6 bg-white/[0.01]">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
                  AGENT WALLET
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white">
                    {agent.operator.slice(0, 8)}...{agent.operator.slice(-8)}
                  </span>
                  <CopyButton value={agent.operator} />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
                  VAULT
                </div>
                <Link
                  href={`/agent/${agent.vault}`}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors duration-300"
                >
                  View Vault →
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-6 pb-8 border-b border-white/10">
              <div>
                <label htmlFor="systemPrompt" className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
                  System Prompt * (this is your alpha)
                </label>
                <textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0d1117] border border-white/10 px-4 py-3 text-white font-mono text-sm resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="You are a research assistant specialized in..."
                />
                {errors.systemPrompt && (
                  <p className="text-xs text-red-400 mt-1 font-mono">{errors.systemPrompt}</p>
                )}
              </div>

              <div>
                <label htmlFor="price" className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
                  Price per call *
                </label>
                <PriceInput value={pricePerCall} onChange={setPricePerCall} />
                {errors.pricePerCall && (
                  <p className="text-xs text-red-400 mt-1 font-mono">{errors.pricePerCall}</p>
                )}
              </div>

              <div>
                <label htmlFor="apiKey" className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
                  Anthropic API Key (leave blank to keep current)
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[#0d1117] border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="sk-ant-..."
                />
                {errors.apiKey && (
                  <p className="text-xs text-red-400 mt-1 font-mono">{errors.apiKey}</p>
                )}
                <p className="text-xs text-white/40 mt-2 font-mono">
                  Only enter if you want to update the API key
                </p>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 bg-[#0d1117] border border-white/10 checked:bg-cyan-500 checked:border-cyan-500 focus:outline-none focus:ring-0"
                  />
                  <span className="text-sm text-white">Agent is active and accepting calls</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-cyan-500 text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <Link href="/dashboard/operator">
                <button className="text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors duration-300 font-mono">
                  CANCEL
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
