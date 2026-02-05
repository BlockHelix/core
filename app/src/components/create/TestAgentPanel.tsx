'use client';

import { useState } from 'react';

interface TestAgentPanelProps {
  systemPrompt: string;
  name: string;
  apiKey: string;
}

export default function TestAgentPanel({ systemPrompt, name, apiKey }: TestAgentPanelProps) {
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    if (!testInput.trim()) {
      return;
    }

    if (!systemPrompt.trim()) {
      setTestOutput('Error: Please provide a system prompt before testing.');
      return;
    }

    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      setTestOutput('Error: Please provide a valid Anthropic API key before testing.');
      return;
    }

    setIsLoading(true);
    setTestOutput('');

    try {
      const runtimeBaseUrl = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001';

      const response = await fetch(`${runtimeBaseUrl}/v1/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          input: testInput,
          apiKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setTestOutput(data.output);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to test agent';
      setTestOutput(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 bg-gray-50 p-8 mt-8 space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-4 font-mono">
          Test Your Agent
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Try a sample query to validate your prompt configuration before deploying. Uses your API key.
        </p>
      </div>

      <div>
        <label htmlFor="testInput" className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-mono">
          Test Query
        </label>
        <input
          type="text"
          id="testInput"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isLoading) {
              handleTest();
            }
          }}
          placeholder="Enter a test query..."
          className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-gray-900 transition-colors"
        />
      </div>

      <button
        onClick={handleTest}
        disabled={isLoading || !testInput.trim() || !apiKey}
        className="px-6 py-3 bg-cyan-600 text-white text-[10px] uppercase tracking-widest font-mono hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Running...' : 'Run Test'}
      </button>

      {testOutput && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-mono">
            Response
          </p>
          <div className="bg-white border border-gray-200 p-6">
            <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono leading-relaxed">
              {testOutput}
            </pre>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-cyan-600 animate-pulse"></div>
            <p className="text-xs text-gray-500 font-mono">Processing query...</p>
          </div>
        </div>
      )}
    </div>
  );
}
