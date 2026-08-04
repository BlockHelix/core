export const BASE_CHAIN_ID = 8453;
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASESCAN_URL = 'https://basescan.org';

export const MAINNET_CHAIN_ID = 1;
export const MAINNET_USDC_ADDRESS = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

// Chains offered in the deploy form. `live: false` renders the option but blocks
// selection: the chain goes live when the factory contracts exist there (the backend
// DTO is the real gate; this flag only drives the UI state).
export interface DeployChainOption {
  chainId: number;
  name: string;
  usdcAddress: string;
  live: boolean;
  tagline: string;
}

export const DEPLOY_CHAINS: DeployChainOption[] = [
  {
    chainId: BASE_CHAIN_ID,
    name: 'Base',
    usdcAddress: BASE_USDC_ADDRESS,
    live: true,
    tagline: 'Lend-side profiles · ~4% class',
  },
  {
    chainId: MAINNET_CHAIN_ID,
    name: 'Ethereum mainnet',
    usdcAddress: MAINNET_USDC_ADDRESS,
    live: true,
    tagline: 'Levered carry profiles run here',
  },
];

export const DEPLOYMENT_STATUSES = [
  'queued',
  'validating',
  'simulating',
  'broadcasting',
  'confirming',
  'verifying',
  'complete',
  'failed',
] as const;

export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const TERMINAL_STATUSES: DeploymentStatus[] = ['complete', 'failed'];

export const PROGRESS_STEPS: DeploymentStatus[] = [
  'queued',
  'validating',
  'simulating',
  'broadcasting',
  'confirming',
  'verifying',
  'complete',
];

export interface CreateVaultRequest {
  chainId: number;
  baseAssetAddress: string;
  pauserAddress: string;
  /** Owns the manager so the trade policy stays updatable. Omit to renounce (policy frozen). */
  managerOwner?: string;
  payoutAddress: string;
  platformFeeBps: number;
  performanceFeeBps: number;
  vaultName: string;
  vaultSymbol: string;
}

export interface DeploymentRecord {
  id: string;
  chainId: number;
  status: DeploymentStatus;
  vaultName: string;
  vaultSymbol: string;
  baseAsset: string;
  pauserAddress: string;
  payoutAddress: string;
  platformFeeBps: number;
  performanceFeeBps: number;
  addresses: Record<string, string> | null;
  transactionHashes: string[];
  sourceVerification: SourceVerification | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceVerification {
  ok: boolean;
  entries: {
    component: string;
    address: string;
    status: 'verified' | 'already-verified' | 'failed' | 'skipped';
    detail?: string;
  }[];
}

export function sourceVerified(
  report: SourceVerification | null | undefined,
  component: string,
): boolean {
  const entry = report?.entries.find((e) => e.component === component);
  return entry?.status === 'verified' || entry?.status === 'already-verified';
}

export interface VaultListResponse {
  deployments: DeploymentRecord[];
  quota: { used: number; limit: number | null }; // limit null = unlimited (entitlement override)
}

export const VAULT_NAME_RE = /^[a-zA-Z0-9 ._-]+$/;
export const VAULT_SYMBOL_RE = /^[a-zA-Z0-9._-]+$/;
export const MAX_PLATFORM_FEE_BPS = 2000;
export const MAX_PERFORMANCE_FEE_BPS = 5000;

export const COMPONENT_LABELS: Record<string, string> = {
  boringVault: 'Vault',
  teller: 'Teller',
  accountant: 'Accountant',
  manager: 'Manager',
  rolesAuthority: 'Roles Authority',
  lens: 'Lens',
  boringQueue: 'Boring Queue',
  queueSolver: 'Queue Solver',
  pauser: 'Pauser',
  timelock: 'Timelock',
  drone: 'Drone',
};

export function statusLabel(status: DeploymentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
