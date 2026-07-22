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

// Veda TellerWithMultiAssetSupport: deposit(depositAsset, depositAmount, minimumMint) -> shares.
// The boringVault (not the teller) pulls the asset via transferFrom, so the depositor approves
// the vault, then calls this.
export const TELLER_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'depositAsset', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'minimumMint', type: 'uint256' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const;

// Veda DelayedWithdraw: async withdrawals. requestWithdraw escrows the user's shares (so the user
// approves the delayedWithdrawer to spend boringVault shares) and starts a delay; after maturity,
// completeWithdraw burns the shares and sends the asset. cancelWithdraw returns the shares.
export const DELAYED_WITHDRAW_ABI = [
  {
    type: 'function',
    name: 'requestWithdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'shares', type: 'uint96' },
      { name: 'maxLoss', type: 'uint16' },
      { name: 'allowThirdPartyToComplete', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelWithdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'completeWithdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: 'assetsOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'withdrawRequests',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'asset', type: 'address' },
    ],
    outputs: [
      { name: 'allowThirdPartyToComplete', type: 'bool' },
      { name: 'maxLoss', type: 'uint16' },
      { name: 'maturity', type: 'uint40' },
      { name: 'shares', type: 'uint96' },
      { name: 'exchangeRateAtTimeOfRequest', type: 'uint96' },
    ],
  },
] as const;

// Minimal ERC20 for the deposit approve / allowance / balance flow.
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;
