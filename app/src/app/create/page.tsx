'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateAgent } from '@/hooks/useCreateAgent';
import { motion } from 'framer-motion';
import WalletButton from '@/components/WalletButton';

export default function CreateAgent() {
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
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            <h1 className="font-display text-4xl font-bold text-helix-primary mb-3">
              Create Agent
            </h1>
            <p className="text-helix-secondary mb-8">
              Deploy a new tokenized autonomous agent on Solana
            </p>

            <div className="bg-helix-card border border-helix-border rounded-lg p-8 text-center">
              <p className="text-helix-secondary mb-6">
                Connect your wallet to create an agent
              </p>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <h1 className="font-display text-4xl font-bold text-helix-primary mb-3">
            Create Agent
          </h1>
          <p className="text-helix-secondary mb-8">
            Deploy a new tokenized autonomous agent on Solana
          </p>

          <form onSubmit={handleSubmit} className="bg-helix-card border border-helix-border rounded-lg p-8">
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-helix-secondary mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  placeholder="e.g., DeFi Yield Optimizer"
                />
              </div>

              <div>
                <label htmlFor="githubHandle" className="block text-sm font-medium text-helix-secondary mb-2">
                  GitHub Handle *
                </label>
                <input
                  type="text"
                  id="githubHandle"
                  name="githubHandle"
                  required
                  value={formData.githubHandle}
                  onChange={handleChange}
                  className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  placeholder="e.g., defi-optimizer-ai"
                />
              </div>

              <div>
                <label htmlFor="endpoint" className="block text-sm font-medium text-helix-secondary mb-2">
                  Service Endpoint URL *
                </label>
                <input
                  type="url"
                  id="endpoint"
                  name="endpoint"
                  required
                  value={formData.endpoint}
                  onChange={handleChange}
                  className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  placeholder="https://api.example.com/agent"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="agentFee" className="block text-sm font-medium text-helix-secondary mb-2">
                    Agent Performance Fee (%)
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
                    className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary font-data focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="protocolFee" className="block text-sm font-medium text-helix-secondary mb-2">
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
                    className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary font-data focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full mt-8 bg-helix-cyan text-helix-bg font-bold rounded-md px-6 py-3 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Agent'}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
