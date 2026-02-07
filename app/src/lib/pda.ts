import { PublicKey } from '@solana/web3.js';
import { PROGRAM_IDS } from './anchor';

export function findFactoryState(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    PROGRAM_IDS.FACTORY
  );
}

export function findAgentMetadata(factoryState: PublicKey, agentCount: number): [PublicKey, number] {
  const countBuffer = Buffer.alloc(8);
  countBuffer.writeBigUInt64LE(BigInt(agentCount));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), factoryState.toBuffer(), countBuffer],
    PROGRAM_IDS.FACTORY
  );
}

export function findVaultState(agentWallet: PublicKey, nonce: number): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), agentWallet.toBuffer(), nonceBuffer],
    PROGRAM_IDS.VAULT
  );
}

export function findShareMint(vaultState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shares'), vaultState.toBuffer()],
    PROGRAM_IDS.VAULT
  );
}

export function findRegistryState(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), vault.toBuffer()],
    PROGRAM_IDS.REGISTRY
  );
}

export function findDepositRecord(vaultState: PublicKey, depositor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('deposit'), vaultState.toBuffer(), depositor.toBuffer()],
    PROGRAM_IDS.VAULT
  );
}

export function findJobReceipt(registryState: PublicKey, jobId: number): [PublicKey, number] {
  const jobIdBuffer = Buffer.alloc(8);
  jobIdBuffer.writeBigUInt64LE(BigInt(jobId));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('job'), registryState.toBuffer(), jobIdBuffer],
    PROGRAM_IDS.REGISTRY
  );
}
