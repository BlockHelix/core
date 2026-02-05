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

const ADMIN_SECRET = typeof window !== 'undefined'
  ? process.env.NEXT_PUBLIC_ADMIN_SECRET
  : undefined;

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
      ...(ADMIN_SECRET ? { 'Authorization': `Bearer ${ADMIN_SECRET}` } : {}),
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
