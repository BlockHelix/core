export interface RegisterAgentParams {
  agentId: string;
  name: string;
  systemPrompt: string;
  priceUsdcMicro: number;
  model?: string;
  agentWallet: string;
  vault: string;
  registry?: string;
  isActive?: boolean;
  apiKey: string;
  ownerWallet?: string;
}

export interface RegisterAgentResponse {
  message: string;
  agent: {
    agentId: string;
    name: string;
    priceUsdcMicro: number;
    model: string;
    isActive: boolean;
  };
}

const RUNTIME_URL = typeof window !== 'undefined'
  ? process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001'
  : '';

export async function registerAgentWithRuntime(
  params: RegisterAgentParams
): Promise<RegisterAgentResponse> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const response = await fetch(`${RUNTIME_URL}/admin/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: params.agentId,
      name: params.name,
      systemPrompt: params.systemPrompt,
      priceUsdcMicro: params.priceUsdcMicro,
      model: params.model || 'claude-sonnet-4-20250514',
      agentWallet: params.agentWallet,
      vault: params.vault,
      registry: params.registry || '',
      isActive: params.isActive ?? true,
      apiKey: params.apiKey,
      ownerWallet: params.ownerWallet,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Runtime registration failed: ${response.status}`);
  }

  return response.json();
}

export async function checkRuntimeHealth(): Promise<boolean> {
  if (!RUNTIME_URL) return false;

  try {
    const response = await fetch(`${RUNTIME_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface AgentSummary {
  agentId: string;
  name: string;
  priceUsdcMicro: number;
  model: string;
  agentWallet: string;
  vault: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AgentDetail extends AgentSummary {
  systemPrompt: string;
  registry: string;
  ownerWallet: string;
}

export interface UpdateAgentParams {
  agentId: string;
  wallet: string;
  signMessage: (message: string) => Promise<Uint8Array>;
  updates: {
    systemPrompt?: string;
    apiKey?: string;
    priceUsdcMicro?: number;
    model?: string;
    isActive?: boolean;
  };
}

export async function getAgentsByOwner(wallet: string): Promise<AgentSummary[]> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const response = await fetch(`${RUNTIME_URL}/admin/agents/by-owner?wallet=${wallet}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch agents: ${response.status}`);
  }

  const data = await response.json();
  return data.agents;
}

export async function getAgentDetail(agentId: string, wallet?: string): Promise<AgentDetail> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const url = wallet
    ? `${RUNTIME_URL}/admin/agents/${agentId}?wallet=${wallet}`
    : `${RUNTIME_URL}/admin/agents/${agentId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch agent: ${response.status}`);
  }

  return response.json();
}

export async function updateAgentConfig(params: UpdateAgentParams): Promise<void> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const message = `BlockHelix: update agent ${params.agentId} at ${Date.now()}`;
  const signatureBytes = await params.signMessage(message);

  const bs58 = (await import('bs58')).default;
  const signature = bs58.encode(signatureBytes);

  const response = await fetch(`${RUNTIME_URL}/admin/agents/${params.agentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      signature,
      wallet: params.wallet,
      updates: params.updates,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update agent: ${response.status}`);
  }
}
