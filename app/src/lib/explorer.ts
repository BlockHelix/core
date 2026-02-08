const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

export function explorerTxUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=${NETWORK}`;
}

export function explorerAddressUrl(addr: string) {
  return `https://explorer.solana.com/address/${addr}?cluster=${NETWORK}`;
}
