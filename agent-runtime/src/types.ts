export interface AgentConfig {
  agentId: string;
  name: string;
  systemPrompt: string;
  priceUsdcMicro: number;
  model: string;
  operator: string;
  vault: string;
  registry: string;
  isActive: boolean;
  apiKey: string;
}

export interface RunRequest {
  input: string;
  context?: Record<string, unknown>;
}

export interface RunResponse {
  output: string;
  agentId: string;
  jobId: number | null;
  receiptTx: string | null;
  revenueTx: string | null;
}

export interface OnChainAgentMetadata {
  factory: string;
  operator: string;
  vault: string;
  registry: string;
  shareMint: string;
  name: string;
  githubHandle: string;
  endpointUrl: string;
  agentId: number;
  createdAt: number;
  isActive: boolean;
}
