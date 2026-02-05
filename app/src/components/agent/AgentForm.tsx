'use client';

import { AgentTier } from './TierSelector';

interface AgentFormProps {
  tier: AgentTier;
  objective: string;
  systemPrompt: string;
  tools: string[];
  maxIterations: number;
  onObjectiveChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
  onToolsChange: (tools: string[]) => void;
  onMaxIterationsChange: (value: number) => void;
}

const ALL_TOOLS = [
  { id: 'web_search', label: 'Web Search', description: 'Search the web for information' },
  { id: 'web_fetch', label: 'Web Fetch', description: 'Fetch content from URLs' },
  { id: 'bash', label: 'Bash', description: 'Execute bash commands' },
  { id: 'read', label: 'Read Files', description: 'Read file contents' },
  { id: 'write', label: 'Write Files', description: 'Write or edit files' },
  { id: 'glob', label: 'Glob', description: 'Find files by pattern' },
  { id: 'grep', label: 'Grep', description: 'Search file contents' },
];

export default function AgentForm({
  tier,
  objective,
  systemPrompt,
  tools,
  maxIterations,
  onObjectiveChange,
  onSystemPromptChange,
  onToolsChange,
  onMaxIterationsChange,
}: AgentFormProps) {
  const availableTools = tier === 'free'
    ? ALL_TOOLS.filter(t => ['web_search', 'web_fetch'].includes(t.id))
    : ALL_TOOLS;

  const maxIter = tier === 'free' ? 3 : 10;

  const handleToolToggle = (toolId: string) => {
    if (tools.includes(toolId)) {
      onToolsChange(tools.filter(t => t !== toolId));
    } else {
      onToolsChange([...tools, toolId]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          Objective
        </label>
        <textarea
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value)}
          placeholder="What should the agent accomplish?"
          rows={3}
          className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none transition-colors font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          System Prompt (optional)
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          placeholder="Additional instructions for the agent..."
          rows={3}
          className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500 focus:outline-none transition-colors font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          Tools
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableTools.map((tool) => {
            const isDisabled = tier === 'free' && !['web_search', 'web_fetch'].includes(tool.id);
            const isChecked = tools.includes(tool.id);

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => !isDisabled && handleToolToggle(tool.id)}
                disabled={isDisabled}
                className={`
                  p-3 border text-left transition-all duration-200
                  ${isDisabled
                    ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                    : isChecked
                      ? 'border-cyan-500 bg-cyan-500/5'
                      : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                  }
                `}
              >
                <div className="flex items-start">
                  <div className={`
                    w-4 h-4 rounded border mr-3 mt-0.5 flex-shrink-0
                    ${isDisabled
                      ? 'border-white/10'
                      : isChecked
                        ? 'border-cyan-500 bg-cyan-500'
                        : 'border-white/20'
                    }
                  `}>
                    {isChecked && !isDisabled && (
                      <svg className="w-full h-full text-black" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8l2 2 4-4" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-sm text-white">{tool.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">{tool.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          Max Iterations
        </label>
        <input
          type="number"
          min={1}
          max={maxIter}
          value={maxIterations}
          onChange={(e) => onMaxIterationsChange(Math.min(maxIter, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white focus:border-cyan-500 focus:outline-none transition-colors font-mono"
        />
        <p className="text-xs text-white/40 mt-2">
          Maximum: {maxIter} iterations for {tier === 'free' ? 'Free' : 'Pro'} tier
        </p>
      </div>
    </div>
  );
}
