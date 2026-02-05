'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import TierSelector, { AgentTier } from '@/components/agent/TierSelector';
import AgentForm from '@/components/agent/AgentForm';
import PaymentButton from '@/components/agent/PaymentButton';
import ExecutionLog from '@/components/agent/ExecutionLog';
import { toast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';

interface Step {
  type: 'thought' | 'tool_use' | 'tool_result' | 'response';
  content: string;
  tool?: string;
  timestamp: string;
}

export default function AgentContent() {
  const { authenticated, login, walletAddress } = useAuth();
  const [selectedTier, setSelectedTier] = useState<AgentTier>('free');
  const [objective, setObjective] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [tools, setTools] = useState<string[]>(['web_search', 'web_fetch']);
  const [maxIterations, setMaxIterations] = useState(3);
  const [paymentSignature, setPaymentSignature] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [executionSteps, setExecutionSteps] = useState<Step[]>([]);
  const [executionError, setExecutionError] = useState<string | undefined>();
  const [finalOutput, setFinalOutput] = useState<string | undefined>();

  const agentUrl = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001';

  const handleTierChange = (tier: AgentTier) => {
    setSelectedTier(tier);
    setMaxIterations(tier === 'free' ? 3 : 10);
    if (tier === 'free') {
      setTools(['web_search', 'web_fetch']);
    }
    setPaymentSignature(null);
  };

  const canRun = () => {
    if (!objective.trim()) return false;
    if (selectedTier === 'pro' && !paymentSignature) return false;
    return true;
  };

  const handlePaymentComplete = (signature: string) => {
    setPaymentSignature(signature);
    toast('Payment confirmed! You can now run the agent.', 'success');
  };

  const handleRun = async () => {
    if (!canRun()) return;

    if (selectedTier === 'pro' && !authenticated) {
      toast('Please connect your wallet for Pro tier', 'error');
      return;
    }

    setExecutionStatus('running');
    setExecutionSteps([]);
    setExecutionError(undefined);
    setFinalOutput(undefined);

    const agentId = authenticated && walletAddress ? walletAddress : 'anonymous';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (selectedTier === 'pro' && paymentSignature) {
        headers['X-Payment-Tx'] = paymentSignature;
      }

      const response = await fetch(`${agentUrl}/agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agentId,
          objective,
          systemPrompt: systemPrompt || undefined,
          tools,
          maxIterations,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.steps) {
        setExecutionSteps(data.steps);
      }

      if (data.output) {
        setFinalOutput(data.output);
      }

      setExecutionStatus('completed');
      toast('Agent execution completed!', 'success');
    } catch (err: any) {
      console.error('Agent execution error:', err);
      setExecutionStatus('error');
      setExecutionError(err.message || 'Failed to execute agent');
      toast(err.message || 'Failed to execute agent', 'error');
    }
  };

  const needsPayment = selectedTier === 'pro' && !paymentSignature;
  const needsWallet = selectedTier === 'pro' && !authenticated;

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-12">
          <h1 className="font-mono text-4xl font-bold text-white mb-4">
            Run Agent
          </h1>
          <p className="text-white/60">
            Execute autonomous agents with web search, code execution, and more.
          </p>
        </div>

        <TierSelector selectedTier={selectedTier} onSelectTier={handleTierChange} />

        <div className="border border-white/10 bg-white/[0.02] corner-cut-sm p-8">
          <AgentForm
            tier={selectedTier}
            objective={objective}
            systemPrompt={systemPrompt}
            tools={tools}
            maxIterations={maxIterations}
            onObjectiveChange={setObjective}
            onSystemPromptChange={setSystemPrompt}
            onToolsChange={setTools}
            onMaxIterationsChange={setMaxIterations}
          />

          <div className="mt-8 pt-8 border-t border-white/10">
            {needsWallet ? (
              <button
                onClick={login}
                className="w-full px-6 py-4 bg-cyan-500 text-black font-mono text-sm uppercase tracking-wider hover:bg-cyan-400 transition-colors"
              >
                Connect Wallet to Continue
              </button>
            ) : needsPayment ? (
              <PaymentButton amount={0.10} onPaymentComplete={handlePaymentComplete} />
            ) : (
              <button
                onClick={handleRun}
                disabled={!canRun() || executionStatus === 'running'}
                className={`
                  w-full px-6 py-4 font-mono text-sm uppercase tracking-wider transition-colors
                  ${!canRun() || executionStatus === 'running'
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-cyan-500 text-black hover:bg-cyan-400'
                  }
                `}
              >
                {executionStatus === 'running' ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Agent...
                  </span>
                ) : (
                  'Run Agent'
                )}
              </button>
            )}
          </div>
        </div>

        <ExecutionLog
          steps={executionSteps}
          status={executionStatus}
          error={executionError}
          finalOutput={finalOutput}
        />
      </div>
    </div>
  );
}
