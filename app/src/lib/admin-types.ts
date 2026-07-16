// Client-safe types shared between the admin UI and the Next route handlers.
// No server-only imports so these can be pulled into 'use client' components.

export interface AdminEntitlement {
  vaultsTotal?: number;
  tradesPerDay?: number;
  unlimited: boolean;
  note?: string;
}

export interface AdminVault {
  id: string;
  userId: string;
  email: string | null;
  status: string;
  vaultName: string;
  vaultSymbol: string;
  chainId: number;
  addresses: Record<string, string | null> | null;
  transactionHashes: string[];
  createdAt: string;
}

export interface AdminUser {
  userId: string;
  email: string | null;
  tier: string;
  vaultsUsed: number;
  entitlement: AdminEntitlement | null;
}

export interface AdminVaultsResponse {
  vaults: AdminVault[];
}

export interface AdminUsersResponse {
  users: AdminUser[];
}

// Body accepted by POST /admin/users/:userId/entitlements.
export interface AdminEntitlementInput {
  vaultsTotal?: number;
  tradesPerDay?: number;
  unlimited?: boolean;
  note?: string;
}
