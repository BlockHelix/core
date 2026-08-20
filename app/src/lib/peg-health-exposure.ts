// Peg-health is a market scan for the Ethereum apxUSD PT loop, not a vault field.
// Never paint it on a vault that does not hold that book (empty Base vaults leaked it).

const PEG_MARKERS = ['apxusd', 'pt-apyusd', 'pt-apyusd/apxusd', 'apyusd'];

export function vaultHoldsPegVenue(input: {
  chainId?: number | null;
  positions?: { symbol?: string; market?: string }[] | null;
  risks?: { market?: string }[] | null;
}): boolean {
  if (input.chainId != null && input.chainId !== 1) return false;
  const hay = [
    ...(input.positions ?? []).flatMap((p) => [p.symbol, p.market]),
    ...(input.risks ?? []).map((r) => r.market),
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((s) => s.toLowerCase());
  if (hay.length === 0) return false;
  return hay.some((s) => PEG_MARKERS.some((m) => s.includes(m)));
}
