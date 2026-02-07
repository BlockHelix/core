'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useX402 } from '@/hooks/useX402';
import { formatUSDC } from '@/lib/format';
import { toast } from '@/lib/toast';

type JobType = 'analyze' | 'patch';

const JOB_TYPES: Record<JobType, { label: string; price: number; description: string }> = {
  analyze: {
    label: 'Analyze',
    price: 0.05,
    description: 'Analyze GitHub repo for DeFi vulnerabilities',
  },
  patch: {
    label: 'Patch',
    price: 0.25,
    description: 'Generate patches for found vulnerabilities',
  },
};

interface Props {
  agentId: string;
  endpointUrl: string;
  agentName: string;
}

export function HireAgentForm({ agentId, endpointUrl, agentName }: Props) {
  const { authenticated } = useAuth();
  const { fetchWithPayment, isReady: walletReady } = useX402();

  const [jobType, setJobType] = useState<JobType>('analyze');
  const [repoUrl, setRepoUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const jobConfig = JOB_TYPES[jobType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticated || !walletReady) {
      toast('Please connect your wallet first', 'error');
      return;
    }
    if (!repoUrl) {
      toast('Please enter a repository URL', 'error');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const baseUrl = endpointUrl.replace(/\/+$/, '');
      const inputText = jobType === 'analyze'
        ? `Analyze this GitHub repository for DeFi vulnerabilities: ${repoUrl}${filePath ? ` (focus on file: ${filePath})` : ''}`
        : `Generate patches for vulnerabilities in this GitHub repository: ${repoUrl}${filePath ? ` (focus on file: ${filePath})` : ''}`;

      toast('Requesting agent service (payment required)...', 'info');
      setIsPaying(true);

      const response = await fetchWithPayment(`${baseUrl}/v1/agent/${agentId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText }),
      });

      setIsPaying(false);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Agent returned ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      toast('Job completed successfully!', 'success');
    } catch (err: any) {
      setIsPaying(false);
      const errorMsg = err.message || 'Job submission failed';
      setError(errorMsg);
      toast(`Job failed: ${errorMsg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <h2 className="text-[10px] uppercase tracking-widest text-white/40 mb-6 font-mono">HIRE THIS AGENT</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="border border-white/10 p-6 space-y-5 bg-white/[0.01]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-1 rounded-full bg-cyan-400" />
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold font-mono">JOB CONFIGURATION</span>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">JOB TYPE *</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(JOB_TYPES).map(([key, job]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setJobType(key as JobType)}
                  className={`p-4 border transition-all duration-300 ${
                    jobType === key
                      ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                      : 'border-white/20 bg-white/[0.02] text-white/60 hover:border-white/40'
                  }`}
                >
                  <div className="text-xs uppercase tracking-widest font-bold mb-2">{job.label}</div>
                  <div className="text-[10px] font-mono">${formatUSDC(job.price)}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-white/40">{jobConfig.description}</div>
          </div>

          <div>
            <label htmlFor="hireRepoUrl" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">GITHUB REPOSITORY URL *</label>
            <input
              type="url"
              id="hireRepoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
              placeholder="https://github.com/username/repo"
              className="w-full bg-black/30 border border-white/30 px-4 py-3 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none transition-colors duration-300"
              disabled={isProcessing}
            />
          </div>

          <div>
            <label htmlFor="hireFilePath" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">FILE PATH FILTER (OPTIONAL)</label>
            <input
              type="text"
              id="hireFilePath"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="src/contracts/**/*.sol"
              className="w-full bg-black/30 border border-white/30 px-4 py-3 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none transition-colors duration-300"
              disabled={isProcessing}
            />
          </div>

          <div className="border border-cyan-400/20 bg-cyan-400/5 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-white/30">TOTAL COST</span>
              <span className="text-xl font-bold font-mono tabular-nums text-cyan-400">${formatUSDC(jobConfig.price)} USDC</span>
            </div>
            <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider">
              Split: 70% operator · 5% protocol · 25% vault depositors
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <span className="text-[10px] uppercase tracking-widest font-bold">ERROR:</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!repoUrl || isProcessing}
            className="w-full bg-cyan-400 text-black font-bold px-6 py-4 text-xs uppercase tracking-widest hover:bg-cyan-300 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'PROCESSING...' : 'SUBMIT JOB'}
          </button>
        </form>

        <div className="border border-white/10 bg-[#0d1117] relative overflow-hidden h-full">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">TERMINAL OUTPUT</span>
            </div>
            {isProcessing && (
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest text-emerald-400/60 font-mono">RUNNING</span>
              </div>
            )}
          </div>

          <div className="p-6 font-mono text-sm leading-relaxed overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {!result && !isProcessing && (
              <div className="text-white/30">
                <span className="text-emerald-400">$</span> Waiting for job submission...
                <span className="inline-block w-2 h-4 bg-emerald-400/50 ml-1 animate-pulse" />
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2 text-white/50">
                <div><span className="text-cyan-400">&rarr;</span> Connecting to {agentName}...</div>
                {isPaying ? (
                  <>
                    <div><span className="text-amber-400">&rarr;</span> x402 Payment required - approve in wallet...</div>
                    <div><span className="text-amber-400">&rarr;</span> Transferring ${formatUSDC(jobConfig.price)} USDC<span className="inline-block w-2 h-4 bg-amber-400/50 ml-1 animate-pulse" /></div>
                  </>
                ) : (
                  <>
                    <div><span className="text-emerald-400">&check;</span> Payment confirmed</div>
                    <div><span className="text-cyan-400">&rarr;</span> Agent processing<span className="inline-block w-2 h-4 bg-cyan-400/50 ml-1 animate-pulse" /></div>
                  </>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="text-emerald-400">
                  <span className="text-white/30">$</span> Job completed successfully
                </div>
                <div className="border-t border-white/10 pt-4 mt-4">
                  {result.output && (
                    <div className="text-white/80 whitespace-pre-wrap text-sm">{result.output}</div>
                  )}
                  {result.vulnerabilities && (
                    <div className="space-y-3">
                      <div className="text-white/60"><span className="text-white/30">Found:</span> {result.vulnerabilities.length} vulnerabilities</div>
                      {result.vulnerabilities.map((vuln: any, idx: number) => (
                        <div key={idx} className="border border-amber-400/20 bg-amber-400/5 p-3">
                          <div className="text-amber-400 text-xs font-bold mb-1">{vuln.severity?.toUpperCase() || 'UNKNOWN'} - {vuln.title}</div>
                          <div className="text-white/50 text-xs">{vuln.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.patches && (
                    <div className="space-y-3">
                      <div className="text-white/60"><span className="text-white/30">Generated:</span> {result.patches.length} patches</div>
                      {result.patches.map((patch: any, idx: number) => (
                        <div key={idx} className="border border-emerald-400/20 bg-emerald-400/5 p-3">
                          <div className="text-emerald-400 text-xs font-bold mb-2">PATCH #{idx + 1}: {patch.file}</div>
                          <pre className="text-[10px] text-white/50 overflow-x-auto whitespace-pre-wrap">{patch.diff || patch.content}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                  {!result.output && !result.vulnerabilities && !result.patches && (
                    <pre className="text-[10px] text-white/40 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                  )}
                </div>
                {result.receiptId && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">ON-CHAIN RECEIPT</div>
                    <a
                      href={`https://explorer.solana.com/address/${result.receiptId}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs break-all"
                    >
                      {result.receiptId}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
