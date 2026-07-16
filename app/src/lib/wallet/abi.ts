// Minimal ABIs for the on-chain admin actions. The Veda BoringVault manager,
// teller and accountant are all Pausable; the accountant additionally exposes
// updateExchangeRate(uint96).

export const PAUSABLE_ABI = [
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'unpause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export const ACCOUNTANT_ABI = [
  {
    type: 'function',
    name: 'updateExchangeRate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newExchangeRate', type: 'uint96' }],
    outputs: [],
  },
] as const;
