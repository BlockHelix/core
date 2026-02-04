'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { PROTOCOL_TREASURY } from '@/lib/anchor';
import { motion } from 'framer-motion';
import WalletButton from '@/components/WalletButton';

export default function CreateContent() {
  const router = useRouter();
  const { authenticated: connected } = useAuth();
  const { createAgent, isLoading } = useCreateAgent();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    githubHandle: '',
    endpoint: '',
    agentFee: '2.0',
    protocolFee: '0.5',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const agentFeeBps = Math.floor(parseFloat(formData.agentFee) * 100);
      const protocolFeeBps = Math.floor(parseFloat(formData.protocolFee) * 100);

      const result = await createAgent({
        name: formData.name,
        githubHandle: formData.githubHandle,
        endpointUrl: formData.endpoint,
        agentFeeBps,
        protocolFeeBps,
        challengeWindow: 86400,
        maxTvl: 1_000_000_000_000,
        lockupEpochs: 0,
        epochLength: 86400,
        targetApyBps: 1000,
        lendingFloorBps: 200,
        arbitrator: PROTOCOL_TREASURY.toBase58(),
      });

      router.push(`/agent/${result.agentWallet.toString()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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
            <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6">
              DEPLOY AGENT
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6">
              Deploy Agent
            </h1>
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-16">
              Register an autonomous agent on Solana. Post your operator bond. Set your x402 pricing. Depositors fund your vault and receive revenue shares. You retain 70%.
            </p>

            <div className="border border-white/10 p-16 text-center bg-white/[0.02] corner-cut relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
              <p className="text-sm text-white/50 mb-8 uppercase tracking-wider">
                Wallet connection required for deployment
              </p>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-32 lg:py-48">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6">
            DEPLOY AGENT
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6">
            Deploy Agent
          </h1>
          <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-16">
            Register an autonomous agent on Solana. Post your operator bond. Set your x402 pricing. Depositors fund your vault and receive revenue shares. You retain 70%.
          </p>

          <form onSubmit={handleSubmit} className="border border-white/10 p-10 lg:p-12 space-y-8 bg-white/[0.01] corner-cut relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

            <div>
              <label htmlFor="name" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                Agent Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-black/30 border border-white/30 px-5 py-3.5 text-white text-base focus:border-emerald-400 focus:outline-none transition-colors duration-300 corner-cut-sm"
                placeholder="DeFi Code Analyzer"
              />
            </div>

            <div>
              <label htmlFor="githubHandle" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                GitHub Handle *
              </label>
              <input
                type="text"
                id="githubHandle"
                name="githubHandle"
                required
                value={formData.githubHandle}
                onChange={handleChange}
                className="w-full bg-black/30 border border-white/30 px-5 py-3.5 text-white text-base focus:border-emerald-400 focus:outline-none transition-colors duration-300 corner-cut-sm"
                placeholder="defi-optimizer-ai"
              />
            </div>

            <div>
              <label htmlFor="endpoint" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                Service Endpoint URL *
              </label>
              <input
                type="url"
                id="endpoint"
                name="endpoint"
                required
                value={formData.endpoint}
                onChange={handleChange}
                className="w-full bg-black/30 border border-white/30 px-5 py-3.5 text-white focus:border-emerald-400 focus:outline-none transition-colors duration-300 font-mono text-sm corner-cut-sm"
                placeholder="https://api.example.com/agent"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="agentFee" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  Agent Fee (%)
                </label>
                <input
                  type="number"
                  id="agentFee"
                  name="agentFee"
                  step="0.1"
                  min="0"
                  max="50"
                  value={formData.agentFee}
                  onChange={handleChange}
                  className="w-full bg-black/30 border border-white/30 px-5 py-3.5 text-white font-mono text-base tabular-nums focus:border-emerald-400 focus:outline-none transition-colors duration-300 corner-cut-sm"
                />
              </div>

              <div>
                <label htmlFor="protocolFee" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  Protocol Fee (%)
                </label>
                <input
                  type="number"
                  id="protocolFee"
                  name="protocolFee"
                  step="0.1"
                  min="0.5"
                  max="10"
                  value={formData.protocolFee}
                  onChange={handleChange}
                  className="w-full bg-black/30 border border-white/30 px-5 py-3.5 text-white font-mono text-base tabular-nums focus:border-emerald-400 focus:outline-none transition-colors duration-300 corner-cut-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm corner-cut-sm">
                <span className="text-[10px] uppercase tracking-widest font-bold">ERROR:</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full mt-4 bg-emerald-400 text-black font-bold px-6 py-4 text-xs uppercase tracking-widest hover:bg-emerald-300 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed corner-cut-sm relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              {isSubmitting ? 'DEPLOYING...' : 'DEPLOY AGENT'}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
