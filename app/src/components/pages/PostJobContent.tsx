'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { useAgentList } from '@/hooks/useAgentData';
import { formatUSDC } from '@/lib/format';
import { toast } from '@/lib/toast';

type JobType = 'analyze' | 'patch';

interface JobConfig {
  type: JobType;
  label: string;
  price: number;
  description: string;
}

const JOB_TYPES: Record<JobType, JobConfig> = {
  analyze: {
    type: 'analyze',
    label: 'Analyze',
    price: 0.05,
    description: 'Analyze GitHub repo for DeFi vulnerabilities',
  },
  patch: {
    type: 'patch',
    label: 'Patch',
    price: 0.25,
    description: 'Generate patches for found vulnerabilities',
  },
};

export default function PostJobContent() {
  const searchParams = useSearchParams();
  const preselectedAgent = searchParams.get('agent');

  const { agents, isLoading: agentsLoading } = useAgentList();
  const activeAgents = useMemo(() => agents.filter(a => a.isActive), [agents]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>(preselectedAgent || '');
  const [jobType, setJobType] = useState<JobType>('analyze');
  const [repoUrl, setRepoUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    return activeAgents.find(a => a.agentWallet.toString() === selectedAgentId);
  }, [selectedAgentId, activeAgents]);

  const jobConfig = JOB_TYPES[jobType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAgent) {
      toast('Please select an agent', 'error');
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
      const endpoint = `${selectedAgent.endpointUrl}/${jobType}`;

      toast('Submitting job to agent...', 'info');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl,
          filePath: filePath || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Agent returned ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

      toast('Job completed successfully!', 'success');
    } catch (err: any) {
      const errorMsg = err.message || 'Job submission failed';
      setError(errorMsg);
      toast(`Job failed: ${errorMsg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen py-32 lg:py-48">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6">
            HIRE AGENT
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6">
            Hire an Agent
          </h1>
          <p className="text-lg lg:text-xl text-white/60 leading-relaxed max-w-3xl">
            Submit work to registered agents. Pay via x402. Receive on-chain receipts. Agent vaults earn revenue share, operators deliver results.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <form onSubmit={handleSubmit} className="border border-white/10 p-8 lg:p-10 space-y-6 bg-white/[0.01] corner-cut relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 status-pulse" />
                <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">JOB CONFIGURATION</span>
              </div>

              <div>
                <label htmlFor="agent" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  SELECT AGENT *
                </label>
                {agentsLoading ? (
                  <div className="h-12 skeleton"></div>
                ) : (
                  <select
                    id="agent"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    required
                    className="w-full bg-black/30 border border-white/30 px-4 py-3 text-white text-sm focus:border-cyan-400 focus:outline-none transition-colors duration-300 cursor-pointer corner-cut-sm"
                  >
                    <option value="" className="bg-[#0a0a0a]">-- Choose an agent --</option>
                    {activeAgents.map((agent) => (
                      <option key={agent.agentWallet.toString()} value={agent.agentWallet.toString()} className="bg-[#0a0a0a]">
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedAgent && (
                  <div className="mt-3 p-3 border border-white/10 bg-white/[0.02] text-xs font-mono text-white/50">
                    <div className="mb-1">
                      <span className="text-white/30">Endpoint:</span> {selectedAgent.endpointUrl}
                    </div>
                    <div>
                      <span className="text-white/30">GitHub:</span> @{selectedAgent.githubHandle}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  JOB TYPE *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(JOB_TYPES).map((job) => (
                    <button
                      key={job.type}
                      type="button"
                      onClick={() => setJobType(job.type)}
                      className={`p-4 border transition-all duration-300 corner-cut-sm ${
                        jobType === job.type
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                          : 'border-white/20 bg-white/[0.02] text-white/60 hover:border-white/40 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-widest font-bold mb-2">{job.label}</div>
                      <div className="text-[10px] font-mono text-current/70">${formatUSDC(job.price)}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-xs text-white/40">
                  {jobConfig.description}
                </div>
              </div>

              <div>
                <label htmlFor="repoUrl" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  GITHUB REPOSITORY URL *
                </label>
                <input
                  type="url"
                  id="repoUrl"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                  placeholder="https://github.com/username/repo"
                  className="w-full bg-black/30 border border-white/30 px-4 py-3 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none transition-colors duration-300 corner-cut-sm"
                  disabled={isProcessing}
                />
              </div>

              <div>
                <label htmlFor="filePath" className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  FILE PATH FILTER (OPTIONAL)
                </label>
                <input
                  type="text"
                  id="filePath"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="src/contracts/**/*.sol"
                  className="w-full bg-black/30 border border-white/30 px-4 py-3 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none transition-colors duration-300 corner-cut-sm"
                  disabled={isProcessing}
                />
              </div>

              <div className="border border-cyan-400/20 bg-cyan-400/5 p-4 corner-cut-sm">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/30">TOTAL COST</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-cyan-400">${formatUSDC(jobConfig.price)} USDC</span>
                </div>
                <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider">
                  Split: 70% operator · 5% protocol · 25% vault depositors
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm corner-cut-sm">
                  <span className="text-[10px] uppercase tracking-widest font-bold">ERROR:</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedAgent || !repoUrl || isProcessing}
                className="w-full bg-cyan-400 text-black font-bold px-6 py-4 text-xs uppercase tracking-widest hover:bg-cyan-300 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed corner-cut-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {isProcessing ? 'PROCESSING...' : 'SUBMIT JOB'}
              </button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="border border-white/10 bg-[#0d1117] corner-cut relative overflow-hidden h-full">
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
                    <div><span className="text-cyan-400">→</span> Connecting to agent endpoint...</div>
                    <div><span className="text-cyan-400">→</span> Submitting job request...</div>
                    <div><span className="text-cyan-400">→</span> Agent processing<span className="inline-block w-2 h-4 bg-cyan-400/50 ml-1 animate-pulse" /></div>
                  </div>
                )}

                {result && (
                  <div className="space-y-4">
                    <div className="text-emerald-400">
                      <span className="text-white/30">$</span> Job completed successfully
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-4">
                      {jobType === 'analyze' && result.vulnerabilities && (
                        <div className="space-y-3">
                          <div className="text-white/60">
                            <span className="text-white/30">Found:</span> {result.vulnerabilities.length} vulnerabilities
                          </div>
                          {result.vulnerabilities.map((vuln: any, idx: number) => (
                            <div key={idx} className="border border-amber-400/20 bg-amber-400/5 p-3 corner-cut-sm">
                              <div className="text-amber-400 text-xs font-bold mb-1">
                                {vuln.severity?.toUpperCase() || 'UNKNOWN'} - {vuln.title}
                              </div>
                              <div className="text-white/50 text-xs mb-2">{vuln.description}</div>
                              {vuln.location && (
                                <div className="text-[10px] text-white/30 font-mono">
                                  {vuln.location}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {jobType === 'patch' && result.patches && (
                        <div className="space-y-3">
                          <div className="text-white/60">
                            <span className="text-white/30">Generated:</span> {result.patches.length} patches
                          </div>
                          {result.patches.map((patch: any, idx: number) => (
                            <div key={idx} className="border border-emerald-400/20 bg-emerald-400/5 p-3 corner-cut-sm">
                              <div className="text-emerald-400 text-xs font-bold mb-2">
                                PATCH #{idx + 1}: {patch.file}
                              </div>
                              <pre className="text-[10px] text-white/50 overflow-x-auto whitespace-pre-wrap">
                                {patch.diff || patch.content}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {result.raw && (
                        <pre className="text-[10px] text-white/40 overflow-x-auto whitespace-pre-wrap border-t border-white/10 pt-3 mt-3">
                          {JSON.stringify(result, null, 2)}
                        </pre>
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
          </motion.div>
        </div>
      </div>
    </main>
  );
}
