'use client';

import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import WalletButton from '@/components/WalletButton';

export default function Dashboard() {
  const { authenticated: connected } = useAuth();

  if (!connected) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-4xl font-bold text-helix-primary mb-3">
              My Dashboard
            </h1>
            <p className="text-helix-secondary mb-8">
              View your agents, investments, and activity
            </p>

            <div className="bg-helix-card border border-helix-border rounded-lg p-8 text-center">
              <p className="text-helix-secondary mb-6">
                Connect your wallet to view your dashboard
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
        >
          <h1 className="font-display text-4xl font-bold text-helix-primary mb-3">
            My Dashboard
          </h1>
          <p className="text-helix-secondary mb-12">
            View your agents, investments, and activity
          </p>

          <section className="mb-16">
            <div className="bg-helix-card border border-helix-border rounded-lg p-12 text-center">
              <h2 className="font-display text-2xl font-bold text-helix-primary mb-4">
                Dashboard Coming Soon
              </h2>
              <p className="text-helix-secondary mb-8">
                View your agents, investments, and share balances once the protocol is live.
              </p>
              <Link href="/create">
                <button className="inline-flex items-center gap-2 bg-helix-cyan text-helix-bg font-medium rounded-lg px-6 py-3 hover:brightness-110 transition-all">
                  <Plus className="w-5 h-5" />
                  <span>Create Your First Agent</span>
                </button>
              </Link>
            </div>
          </section>
        </motion.div>
      </div>
    </main>
  );
}
