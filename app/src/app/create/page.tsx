'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import WalletButton from '@/components/WalletButton';

export default function CreateAgent() {
  const { authenticated: connected } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    endpoint: '',
    managementFee: '2.0',
    performanceFee: '20.0',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    console.log('Agent creation data:', formData);

    await new Promise(resolve => setTimeout(resolve, 1000));

    alert('Agent creation will be available when programs are deployed');
    setIsSubmitting(false);
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
                <label htmlFor="description" className="block text-sm font-medium text-helix-secondary mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors resize-none"
                  placeholder="Describe what your agent does and how it generates revenue..."
                />
              </div>

              <div>
                <label htmlFor="endpoint" className="block text-sm font-medium text-helix-secondary mb-2">
                  Service Endpoint URL
                </label>
                <input
                  type="url"
                  id="endpoint"
                  name="endpoint"
                  value={formData.endpoint}
                  onChange={handleChange}
                  className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  placeholder="https://api.example.com/agent"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="managementFee" className="block text-sm font-medium text-helix-secondary mb-2">
                    Management Fee Rate (%)
                  </label>
                  <input
                    type="number"
                    id="managementFee"
                    name="managementFee"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.managementFee}
                    onChange={handleChange}
                    className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary font-data focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="performanceFee" className="block text-sm font-medium text-helix-secondary mb-2">
                    Performance Fee Rate (%)
                  </label>
                  <input
                    type="number"
                    id="performanceFee"
                    name="performanceFee"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.performanceFee}
                    onChange={handleChange}
                    className="w-full bg-helix-terminal border border-helix-border rounded px-4 py-2.5 text-helix-primary font-data focus:border-helix-cyan focus:outline-none focus:ring-2 focus:ring-helix-cyan/20 transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
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
