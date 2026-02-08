// Re-export from central config for backwards compatibility
export {
  PROGRAM_IDS,
  RPC_URL,
  USDC_MINT,
  PROTOCOL_TREASURY,
  NETWORK,
  RUNTIME_URL,
  getExplorerUrl,
} from './network-config';

// Legacy exports - these map to the new config
export const VAULT_PROGRAM_ID = PROGRAM_IDS.VAULT;
export const REGISTRY_PROGRAM_ID = PROGRAM_IDS.REGISTRY;
export const FACTORY_PROGRAM_ID = PROGRAM_IDS.FACTORY;

import { PROGRAM_IDS } from './network-config';
