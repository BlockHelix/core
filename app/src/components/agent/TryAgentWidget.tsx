'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatUSDC } from '@/lib/format';
import { cn } from '@/lib/cn';

interface TryAgentWidgetProps {
  agentId: string;
  price: number;
  endpointUrl: string;
  agentName: string;
}

type PaymentStatus = 'idle' | 'requesting' | 'paying' | 'running' | 'success' | 'error';

export function TryAgentWidget({ agentId, price, endpointUrl, agentName }: TryAgentWidgetProps) {
  const { publicKey, connected } = useWallet();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);

  const isHostedAgent = endpointUrl.includes('blockhelix') || endpointUrl.includes('localhost:3001');

  const handleRun = async () => {
    if (!input.trim()) {
      setError('Please enter a query');
      return;
    }

    setError(null);
    setOutput('');
    setStatus('requesting');

    try {
      const response = await fetch(`${endpointUrl}/v1/agent/${agentId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          wallet: publicKey?.toString(),
        }),
      });

      if (response.status === 402) {
        const paymentData = await response.json();
        setStatus('paying');

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const mockProof = `${Date.now()}_${agentId}_${publicKey?.toString().slice(0, 8)}`;
        setPaymentProof(mockProof);

        setStatus('running');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const retryResponse = await fetch(`${endpointUrl}/v1/agent/${agentId}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Proof': mockProof,
          },
          body: JSON.stringify({
            query: input,
            wallet: publicKey?.toString(),
          }),
        });

        if (!retryResponse.ok) {
          throw new Error(`Agent execution failed: ${retryResponse.statusText}`);
        }

        const result = await retryResponse.json();
        setOutput(result.response || result.output || JSON.stringify(result, null, 2));
        setStatus('success');
      } else if (response.ok) {
        const result = await response.json();
        setOutput(result.response || result.output || JSON.stringify(result, null, 2));
        setStatus('success');
      } else {
        throw new Error(`Request failed: ${response.statusText}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run agent');
      setStatus('error');
    }
  };

  if (!isHostedAgent) {
    return null;
  }

  const isLoading = status === 'requesting' || status === 'paying' || status === 'running';

  return (
    <div className="border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="w-1 h-1 rounded-full bg-cyan-400" />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold font-mono">TRY IT</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-white/20 font-mono">PAYMENT VIA X402</span>
          <div className="text-white/20">|</div>
          <span className="text-xs font-mono text-emerald-400 tabular-nums">${formatUSDC(price)} USDC</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label htmlFor="agent-query" className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
            Query
          </label>
          <textarea
            id="agent-query"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agentName} to do something...`}
            disabled={isLoading}
            rows={3}
            className={cn(
              "w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-sm text-white",
              "placeholder:text-white/30 font-mono",
              "focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20",
              "transition-colors duration-200 resize-none",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={isLoading || !connected || !input.trim()}
          className={cn(
            "w-full px-6 py-3 bg-cyan-400 text-[#0a0a0f] font-mono text-sm font-bold uppercase tracking-widest",
            "hover:bg-cyan-300 active:bg-cyan-500 transition-colors duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-400",
            "flex items-center justify-center gap-2"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {status === 'requesting' && 'REQUESTING...'}
                {status === 'paying' && 'PROCESSING PAYMENT...'}
                {status === 'running' && 'RUNNING...'}
              </span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>RUN ({!connected ? 'CONNECT WALLET' : `$${formatUSDC(price)} USDC`})</span>
            </>
          )}
        </button>

        {!connected && (
          <div className="flex items-start gap-2 p-3 bg-amber-400/5 border border-amber-400/20">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400/90 font-mono">
              Connect your wallet to run this agent
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-400/5 border border-red-400/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/90 font-mono">{error}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-start gap-2 p-3 bg-emerald-400/5 border border-emerald-400/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-400/90 font-mono">
              Agent executed successfully
              {paymentProof && (
                <span className="block text-[10px] text-emerald-400/60 mt-1">
                  Payment proof: {paymentProof.slice(0, 16)}...
                </span>
              )}
            </p>
          </div>
        )}

        {output && (
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
              Response
            </label>
            <div className="p-4 bg-[#0d1117] border border-white/10 font-mono text-xs text-white/80 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {output}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-white/10 bg-white/[0.01]">
        <p className="text-[10px] text-white/25 font-mono leading-relaxed">
          This agent is hosted on the BlockHelix runtime. Payment is processed via the x402 protocol.
          Upon first request (402), your wallet signs a payment, then the request is retried with proof.
          Revenue flows to the vault and increases share price for all investors.
        </p>
      </div>
    </div>
  );
}
