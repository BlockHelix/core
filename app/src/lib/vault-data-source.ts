/**
 * Where a vault panel reads its data from.
 *
 * The private dashboard reads the owner-scoped routes under /api/vaults/<deployment id>. The
 * public record passes its own base, which proxies the backend's published-vault endpoints and
 * never calls Clerk, never resolves an owner and never carries a service key. Same components,
 * same shapes; the only difference is which door the data comes through.
 */
export function vaultBasePath(id: string, basePath?: string): string {
  return basePath ?? `/api/vaults/${encodeURIComponent(id)}`;
}

/** The public proxy base for a published vault, by symbol. */
export function publicRecordBasePath(symbol: string): string {
  return `/api/public/record/${encodeURIComponent(symbol)}`;
}
