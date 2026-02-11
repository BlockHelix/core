'use client';

import { useAuth } from '@/hooks/useAuth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Settings, Plus } from 'lucide-react';
import { getAgentsByOwner, type AgentSummary } from '@/lib/runtime';
import { formatUSDC } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import WalletButton from '@/components/WalletButton';

export default function OperatorDashboard() {
  const { authenticated: connected } = useAuth();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !wallet?.address) {
      setIsLoading(false);
      return;
    }

    const fetchAgents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAgentsByOwner(wallet.address);
        setAgents(data);
      } catch (err: any) {
        console.error('Failed to fetch agents:', err);
        setError(err.message || 'Failed to load agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [connected, wallet?.address]);

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
              OPERATOR DASHBOARD
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6 font-mono">
              Manage Your Agents
            </h1>
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-16">
              Configure prompts, API keys, and pricing for your deployed agents
            </p>

            <div className="border border-white/10 p-16 text-center bg-white/[0.02]">
              <p className="text-lg text-white/60 mb-10">
                Connect wallet to access operator dashboard
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
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-8">
            <div className="h-12 skeleton w-1/2"></div>
            <div className="h-6 skeleton w-3/4"></div>
            <div className="grid grid-cols-1 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 skeleton"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between mb-12">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-mono">
                OPERATOR DASHBOARD
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
                My Agents
              </h1>
              <p className="text-sm text-white/50 leading-relaxed">
                Configure and manage your deployed agents
              </p>
            </div>
            <Link href="/deploy">
              <button className="inline-flex items-center gap-2 bg-cyan-500 text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors duration-300">
                <Plus className="w-4 h-4" />
                <span>CREATE AGENT</span>
              </button>
            </Link>
          </div>

          {error && (
            <div className="mb-8 border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-400 font-mono">{error}</p>
            </div>
          )}

          {agents.length === 0 ? (
            <section>
              <div className="border border-white/10 p-16 text-center">
                <h2 className="text-lg font-bold text-white mb-3 font-mono">
                  NO AGENTS DEPLOYED
                </h2>
                <p className="text-white/60 mb-6 text-sm">
                  Deploy your first agent to start earning from inference calls
                </p>
                <Link href="/deploy">
                  <button className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors duration-300">
                    <Plus className="w-4 h-4" />
                    <span>CREATE AGENT</span>
                  </button>
                </Link>
              </div>
            </section>
          ) : (
            <section>
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="border border-white/10 p-6 bg-white/[0.01] hover:bg-white/[0.02] transition-colors duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-bold text-white font-mono">
                            {agent.name}
                          </h3>
                          {agent.isActive ? (
                            <span className="text-[10px] uppercase tracking-widest text-green-400 bg-green-400/10 px-2 py-1 font-mono">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-1 font-mono">
                              INACTIVE
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">
                              PRICE/CALL
                            </div>
                            <div className="text-sm font-mono text-white">
                              ${formatUSDC(agent.priceUsdcMicro / 1_000_000)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">
                              MODEL
                            </div>
                            <div className="text-sm text-white/70">
                              {agent.model.includes('sonnet') ? 'Sonnet 4' : agent.model}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">
                              AGENT WALLET
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-white/70">
                                {agent.operator.slice(0, 4)}...{agent.operator.slice(-4)}
                              </span>
                              <CopyButton value={agent.operator} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">
                              VAULT
                            </div>
                            <Link
                              href={`/agent/${agent.id || agent.vault}`}
                              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors duration-300"
                            >
                              View Vault
                            </Link>
                          </div>
                        </div>
                      </div>
                      <Link href={`/dashboard/agent/${agent.agentId}`}>
                        <button className="inline-flex items-center gap-2 border border-white/20 text-white font-medium px-4 py-2 text-xs uppercase tracking-widest hover:bg-white/5 transition-colors duration-300">
                          <Settings className="w-4 h-4" />
                          <span>CONFIGURE</span>
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </main>
  );
}
