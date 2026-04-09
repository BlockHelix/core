type WalletSignFn = (params: { message: Uint8Array }) => Promise<{ signature: Uint8Array }>;

async function signAdminAuth(walletSign: WalletSignFn): Promise<{ signature: string; signedAt: number }> {
  const signedAt = Date.now();
  const message = `BlockHelix-admin:${signedAt}`;
  const encoded = new TextEncoder().encode(message);
  const result = await walletSign({ message: encoded });
  const bs58 = (await import('bs58')).default;
  return { signature: bs58.encode(result.signature), signedAt };
}

async function signKeyedMessage(
  walletSign: WalletSignFn,
  prefix: string,
  agentId: string,
): Promise<{ signature: string; signedAt: number }> {
  const signedAt = Date.now();
  const message = `${prefix}:${agentId}:${signedAt}`;
  const encoded = new TextEncoder().encode(message);
  const result = await walletSign({ message: encoded });
  const bs58 = (await import('bs58')).default;

  // Privy's signMessage may return the signature as Uint8Array, string,
  // or wrapped in different keys depending on SDK version. Normalize it.
  const raw: unknown = (result as any)?.signature ?? result;
  let sigBytes: Uint8Array;
  if (raw instanceof Uint8Array) {
    sigBytes = raw;
  } else if (Array.isArray(raw)) {
    sigBytes = Uint8Array.from(raw);
  } else if (typeof raw === 'string') {
    // Could be base58 or base64. Assume base58 first; fall back to base64.
    try {
      sigBytes = bs58.decode(raw);
    } catch {
      sigBytes = Uint8Array.from(Buffer.from(raw, 'base64'));
    }
  } else if (raw && typeof (raw as any).buffer !== 'undefined') {
    sigBytes = new Uint8Array((raw as any).buffer);
  } else {
    console.error('[signKeyedMessage] unexpected signature shape', { raw, result });
    throw new Error('Wallet signMessage returned an unexpected signature shape');
  }

  console.log('[signKeyedMessage]', {
    message,
    messageLen: encoded.length,
    sigLen: sigBytes.length,
    sigBase58Preview: bs58.encode(sigBytes).slice(0, 16) + '...',
  });

  return { signature: bs58.encode(sigBytes), signedAt };
}

export interface VaultAccess {
  tier: 'owner' | 'public';
  canEdit: boolean;
  needsKey: boolean;
  mint: string | null;
  holder: string | null;
  expectedClaimer: string | null;
  reason?: string;
}

export async function getVaultAccess(agentId: string, wallet?: string): Promise<VaultAccess> {
  if (!RUNTIME_URL) throw new Error('Runtime URL not configured');
  const url = wallet
    ? `${RUNTIME_URL}/v1/vaults/${agentId}/access?wallet=${encodeURIComponent(wallet)}`
    : `${RUNTIME_URL}/v1/vaults/${agentId}/access`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`access check failed: ${res.status}`);
  return res.json();
}

export async function claimVault(
  agentId: string,
  wallet: string,
  signMessage: WalletSignFn,
): Promise<{ ok: boolean; mint: string; metadataUri: string; imageUri: string; txSignature: string }> {
  if (!RUNTIME_URL) throw new Error('Runtime URL not configured');
  const auth = await signKeyedMessage(signMessage, 'BlockHelix-claim-vault', agentId);
  const res = await fetch(`${RUNTIME_URL}/v1/vaults/${agentId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, signature: auth.signature, signedAt: auth.signedAt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `claim failed: ${res.status}`);
  }
  return res.json();
}

export async function setHolderKey(
  agentId: string,
  wallet: string,
  anthropicKey: string,
  signMessage: WalletSignFn,
): Promise<{ ok: boolean }> {
  if (!RUNTIME_URL) throw new Error('Runtime URL not configured');
  const auth = await signKeyedMessage(signMessage, 'BlockHelix-holder-key', agentId);
  const res = await fetch(`${RUNTIME_URL}/v1/vaults/${agentId}/holder-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet,
      anthropicKey,
      signature: auth.signature,
      signedAt: auth.signedAt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `set key failed: ${res.status}`);
  }
  return res.json();
}

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
  operator?: string;
  signMessage: WalletSignFn;
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

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://agents.blockhelix.tech'
    : 'http://localhost:3001');

export async function registerAgentWithRuntime(
  params: RegisterAgentParams
): Promise<RegisterAgentResponse> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const auth = await signAdminAuth(params.signMessage);

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
      operator: params.operator || params.agentWallet,
      wallet: params.ownerWallet,
      signature: auth.signature,
      signedAt: auth.signedAt,
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
  id?: string;
  agentId: string;
  name: string;
  priceUsdcMicro: number;
  model: string;
  operator: string;
  vault: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AgentDetail extends AgentSummary {
  systemPrompt: string;
  registry: string;
  ownerWallet: string;
  agentWallet?: string;
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

export interface HeartbeatParams {
  enabled: boolean;
  interval?: string;
  model?: string;
  activeStart?: string;
  activeEnd?: string;
  timezone?: string;
}

export interface DeployOpenClawParams {
  agentId: string;
  name: string;
  systemPrompt: string;
  priceUsdcMicro: number;
  model?: string;
  operator: string;
  vault: string;
  registry?: string;
  apiKey: string;
  ownerWallet?: string;
  telegramBotToken?: string;
  operatorTelegram?: string;
  braveApiKey?: string;
  jobSignerPubkey?: string;
  heartbeat?: HeartbeatParams;
  taskDescription?: string;
  budgetUsdcMicro?: number;
  approvalThresholdUsdcMicro?: number;
  signMessage: WalletSignFn;
}

export async function requestJobSignerKeypair(): Promise<string> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const response = await fetch(`${RUNTIME_URL}/admin/keypair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to request job signer: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.publicKey) {
    throw new Error('Runtime did not return a job signer public key');
  }
  return data.publicKey as string;
}

export interface DeployOpenClawResponse {
  message: string;
  agent: {
    agentId: string;
    vault: string;
    name: string;
    priceUsdcMicro: number;
    model: string;
    isActive: boolean;
    isContainerized: boolean;
    deployStatus: string;
  };
}

export async function deployOpenClaw(params: DeployOpenClawParams): Promise<DeployOpenClawResponse> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const auth = await signAdminAuth(params.signMessage);
  const { signMessage: _sm, ...rest } = params;

  const response = await fetch(`${RUNTIME_URL}/admin/openclaw/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...rest, wallet: params.ownerWallet, signature: auth.signature, signedAt: auth.signedAt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `OpenClaw deploy failed: ${response.status}`);
  }

  return response.json();
}

export interface DeployStatusResponse {
  deployStatus: 'pending' | 'deploying' | 'active' | 'failed';
  deployPhase: string | null;
  containerIp: string | null;
  error: string | null;
}

export async function getDeployStatus(agentId: string): Promise<DeployStatusResponse> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const response = await fetch(`${RUNTIME_URL}/admin/openclaw/${agentId}/deploy-status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch deploy status: ${response.status}`);
  }
  return response.json();
}

export interface OpsSummary {
  agent: {
    vault: string;
    name: string;
    agentWallet: string | null;
    operatorTelegram: string | null;
    taskDescription: string | null;
    taskStatus: 'running' | 'paused' | 'completed' | 'budget_exhausted' | 'failed';
  };
  budget: {
    total: number;
    spent: number;
    reserved: number;
    available: number;
    threshold: number;
    status: string;
  } | null;
  spends: Array<{
    id: number;
    amountMicro: number;
    recipient: string | null;
    reason: string | null;
    txSignature: string | null;
    status: string;
    createdAt: string;
  }>;
  pendingApprovals: Array<{
    id: number;
    amountMicro: number;
    reason: string;
    recipient: string | null;
    status: string;
    createdAt: string;
  }>;
}

export async function getOpsSummary(agentId: string): Promise<OpsSummary> {
  if (!RUNTIME_URL) throw new Error('Runtime URL not configured');
  const response = await fetch(`${RUNTIME_URL}/admin/openclaw/${agentId}/ops-summary`);
  if (!response.ok) throw new Error(`Failed to fetch ops summary: ${response.status}`);
  return response.json();
}

export async function setTaskAction(
  agentId: string,
  action: 'pause' | 'resume' | 'complete',
): Promise<void> {
  if (!RUNTIME_URL) throw new Error('Runtime URL not configured');
  const response = await fetch(`${RUNTIME_URL}/admin/openclaw/${agentId}/task-control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) throw new Error(`Failed to ${action} task: ${response.status}`);
}

export interface RegisterCustomAgentParams {
  agentId: string;
  name: string;
  endpointUrl: string;
  priceUsdcMicro: number;
  agentWallet: string;
  vault: string;
  ownerWallet?: string;
  signMessage: WalletSignFn;
}

export async function registerCustomAgent(
  params: RegisterCustomAgentParams
): Promise<RegisterAgentResponse> {
  if (!RUNTIME_URL) {
    throw new Error('Runtime URL not configured');
  }

  const auth = await signAdminAuth(params.signMessage);

  const response = await fetch(`${RUNTIME_URL}/admin/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: params.agentId,
      name: params.name,
      endpointUrl: params.endpointUrl,
      priceUsdcMicro: params.priceUsdcMicro,
      agentWallet: params.agentWallet,
      vault: params.vault,
      registry: '',
      isActive: true,
      ownerWallet: params.ownerWallet,
      isCustom: true,
      wallet: params.ownerWallet,
      signature: auth.signature,
      signedAt: auth.signedAt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Custom agent registration failed: ${response.status}`);
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
