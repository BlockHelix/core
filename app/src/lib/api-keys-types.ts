// Client-safe types shared between the API-keys UI and the Next route handlers.
// No server-only imports here so this can be pulled into 'use client' components.

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  tier: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

// The create endpoint returns everything an ApiKey has plus the raw `key`,
// which is shown to the user exactly once and never persisted client-side.
export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface ApiKeysListResponse {
  keys: ApiKey[];
}

export interface AccountUsage {
  tier: string;
  limitPerDay: number;
  usedToday: number;
  remainingToday: number;
  resetsAt: string;
}

export const API_KEY_NAME_RE = /^[a-zA-Z0-9 ._-]+$/;
export const MAX_API_KEY_NAME_LEN = 64;

// Turn a stored prefix into a masked display token, e.g. `bh_live_a1b2c3••••••••`.
export function maskKey(keyPrefix: string): string {
  return `${keyPrefix}${'•'.repeat(8)}`;
}
