export const BASE_CHAIN_ID = 8453;
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASESCAN_URL = 'https://basescan.org';

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
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultListResponse {
  deployments: DeploymentRecord[];
  quota: { used: number; limit: number };
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
