'use client';

import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Step {
  type: 'thought' | 'tool_use' | 'tool_result' | 'response';
  content: string;
  tool?: string;
  timestamp: string;
}

interface ExecutionLogProps {
  steps: Step[];
  status: 'idle' | 'running' | 'completed' | 'error';
  error?: string;
  finalOutput?: string;
}

export default function ExecutionLog({ steps, status, error, finalOutput }: ExecutionLogProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  if (status === 'idle') {
    return null;
  }

  return (
    <div className="mt-8 border border-white/10 bg-white/[0.02] corner-cut-sm">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm uppercase tracking-wider text-white/80">
            Execution Log
          </h3>
          {status === 'running' && (
            <div className="flex items-center text-cyan-400 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span className="font-mono">Running...</span>
            </div>
          )}
          {status === 'completed' && (
            <div className="flex items-center text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span className="font-mono">Completed</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center text-red-400 text-sm">
              <XCircle className="w-4 h-4 mr-2" />
              <span className="font-mono">Error</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
        {error && (
          <div className="p-4 border border-red-400/20 bg-red-400/5 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(index);
          const preview = step.content.slice(0, 100);

          return (
            <div key={index} className="border border-white/10 bg-white/[0.02]">
              <button
                onClick={() => toggleStep(index)}
                className="w-full px-4 py-3 flex items-start justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start flex-1 text-left">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 mr-2 mt-0.5 text-white/40 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2 mt-0.5 text-white/40 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs uppercase tracking-wider text-cyan-400">
                        {step.type.replace('_', ' ')}
                      </span>
                      {step.tool && (
                        <span className="font-mono text-xs text-white/40">
                          [{step.tool}]
                        </span>
                      )}
                    </div>
                    {!isExpanded && (
                      <p className="text-sm text-white/60 font-mono truncate">
                        {preview}{step.content.length > 100 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <span className="font-mono text-xs text-white/30 ml-4 flex-shrink-0">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/10">
                  <div className="mt-3 text-sm text-white/80 font-mono whitespace-pre-wrap break-words">
                    {step.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {finalOutput && (
          <div className="mt-6 p-6 border border-emerald-400/20 bg-emerald-400/5 corner-cut-sm">
            <h4 className="font-mono text-sm uppercase tracking-wider text-emerald-400 mb-4">
              Final Output
            </h4>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {finalOutput}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
