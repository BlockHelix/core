import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AgentFactory } from '../target/types/agent_factory';
import agentFactoryIdl from '../target/idl/agent_factory.json';

const VAULT_PROGRAM_ID = new PublicKey('HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS');
const REGISTRY_PROGRAM_ID = new PublicKey('jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const PROTOCOL_TREASURY = new PublicKey('8MYvV1Z1CkNwi8BC9R9Lz71Ag59LWwzTBiui6QpHr1Tg');
const RUNTIME_URL = 'https://agents.blockhelix.tech';

function findVaultState(agentWallet: PublicKey, nonce: number): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), agentWallet.toBuffer(), nonceBuffer],
    VAULT_PROGRAM_ID
  );
}

function findShareMint(vaultState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shares'), vaultState.toBuffer()],
    VAULT_PROGRAM_ID
  );
}

function findRegistryState(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), vault.toBuffer()],
    REGISTRY_PROGRAM_ID
  );
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const factoryProgram = new Program(agentFactoryIdl as any, provider) as Program<AgentFactory>;
  const operator = provider.wallet.publicKey;

  console.log('Operator:', operator.toBase58());

  const [factoryState] = PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    factoryProgram.programId
  );

  const factoryData = await factoryProgram.account.factoryState.fetch(factoryState);
  const agentCount = factoryData.agentCount.toNumber();
  console.log('Current agent count:', agentCount);

  const nonce = agentCount;
  const [agentMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), factoryState.toBuffer(), (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(nonce)); return b; })()],
    factoryProgram.programId
  );
  const [vaultState] = findVaultState(operator, nonce);
  const [shareMint] = findShareMint(vaultState);
  const [registryState] = findRegistryState(vaultState);

  const vaultUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, vaultState, true);
  const operatorUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, operator);

  console.log('Vault PDA:', vaultState.toBase58());
  console.log('Share Mint:', shareMint.toBase58());
  console.log('Registry:', registryState.toBase58());

  // Get KMS public key for job signer
  let jobSigner: PublicKey | null = null;
  try {
    const health = await fetch(`${RUNTIME_URL}/health`).then(r => r.json()) as any;
    if (health?.kms?.publicKey) {
      jobSigner = new PublicKey(health.kms.publicKey);
      console.log('Job signer (KMS):', jobSigner.toBase58());
    }
  } catch { /* no KMS */ }

  const tx = await factoryProgram.methods.createAgent(
    'BlockHelix Colosseum Agent',
    'blockhelix',
    RUNTIME_URL,
    200,   // agentFeeBps (2%)
    50,    // protocolFeeBps (0.5%)
    new anchor.BN(86400),     // challengeWindow
    new anchor.BN(10_000_000), // maxTvl
    1,     // lockupEpochs
    new anchor.BN(86400),     // epochLength
    PROTOCOL_TREASURY,        // arbitrator
    jobSigner                 // job_signer (Option<Pubkey>)
  ).accountsPartial({
    factoryState,
    agentMetadata,
    operator,
    vaultState,
    shareMint,
    usdcMint: USDC_MINT,
    vaultUsdcAccount,
    protocolTreasury: PROTOCOL_TREASURY,
    operatorUsdcAccount,
    registryState,
    vaultProgram: VAULT_PROGRAM_ID,
    registryProgram: REGISTRY_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).rpc();

  console.log('\nVault created on-chain!');
  console.log('  Transaction:', tx);
  console.log('  Vault address:', vaultState.toBase58());
  console.log('  Registry:', registryState.toBase58());
  console.log('\nUse this vault address in the deploy script:');
  console.log(`  vault: '${vaultState.toBase58()}'`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
