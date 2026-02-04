import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

const VAULT_PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || 'HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS'
);
const REGISTRY_PROGRAM_ID = new PublicKey(
  process.env.REGISTRY_PROGRAM_ID || 'jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9'
);
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);
const PROTOCOL_TREASURY = new PublicKey(
  process.env.PROTOCOL_TREASURY || '11111111111111111111111111111111'
);
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

let cachedKeypair: Keypair | null = null;

function loadAgentKeypair(): Keypair {
  if (cachedKeypair) return cachedKeypair;
  const walletPath = process.env.AGENT_WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
  const raw = fs.readFileSync(walletPath, 'utf-8');
  const secretKey = Uint8Array.from(JSON.parse(raw));
  cachedKeypair = Keypair.fromSecretKey(secretKey);
  return cachedKeypair;
}

let cachedProvider: anchor.AnchorProvider | null = null;

function getProvider(agentKeypair: Keypair): anchor.AnchorProvider {
  if (cachedProvider) return cachedProvider;
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(agentKeypair);
  cachedProvider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  return cachedProvider;
}

function getVaultPda(agentWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), agentWallet.toBuffer()],
    VAULT_PROGRAM_ID,
  );
}

function getShareMintPda(vaultState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shares'), vaultState.toBuffer()],
    VAULT_PROGRAM_ID,
  );
}

function getRegistryPda(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), vault.toBuffer()],
    REGISTRY_PROGRAM_ID,
  );
}

function getJobReceiptPda(registry: PublicKey, jobCounter: anchor.BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('job'), registry.toBuffer(), jobCounter.toArrayLike(Buffer, 'le', 8)],
    REGISTRY_PROGRAM_ID,
  );
}

function loadIdl(idlPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
}

export async function routeRevenueToVault(
  amount: number,
  jobId: number,
): Promise<{ txSignature: string; vaultState: string } | null> {
  try {
    const agentKeypair = loadAgentKeypair();
    const provider = getProvider(agentKeypair);
    anchor.setProvider(provider);
    const agentWallet = agentKeypair.publicKey;

    const [vaultState] = getVaultPda(agentWallet);
    const [shareMint] = getShareMintPda(vaultState);

    const vaultUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, vaultState, true);
    const agentUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, agentWallet);
    const protocolUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, PROTOCOL_TREASURY);

    const vaultIdl = loadIdl(
      process.env.VAULT_IDL_PATH || `${process.cwd()}/../target/idl/agent_vault.json`
    );

    const vaultProgram = new anchor.Program(vaultIdl as anchor.Idl, provider);

    const amountBn = new anchor.BN(amount);
    const jobIdBn = new anchor.BN(jobId);

    const tx: string = await (vaultProgram.methods as any)
      .receiveRevenue(amountBn, jobIdBn)
      .accounts({
        vaultState,
        agentWallet,
        vaultUsdcAccount,
        shareMint,
        agentUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Revenue routed: ${amount} micro-USDC, job ${jobId}, tx: ${tx}`);
    return { txSignature: tx, vaultState: vaultState.toBase58() };
  } catch (err) {
    console.error('Revenue routing failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function recordJobOnChain(
  artifactHash: Buffer,
  paymentAmount: number,
  paymentTx: string,
  clientPubkey?: string,
): Promise<{ txSignature: string; jobId: number } | null> {
  try {
    const agentKeypair = loadAgentKeypair();
    const provider = getProvider(agentKeypair);
    anchor.setProvider(provider);
    const agentWallet = agentKeypair.publicKey;

    const [vaultState] = getVaultPda(agentWallet);
    const [registryState] = getRegistryPda(vaultState);

    const registryIdl = loadIdl(
      process.env.REGISTRY_IDL_PATH || `${process.cwd()}/../target/idl/receipt_registry.json`
    );

    const registryProgram = new anchor.Program(registryIdl as anchor.Idl, provider);

    let currentJobCounter: anchor.BN;
    try {
      const registryAccount = await (registryProgram.account as any).registryState.fetch(registryState);
      currentJobCounter = registryAccount.jobCounter as anchor.BN;
    } catch {
      console.log('Registry not initialized, skipping job recording');
      return null;
    }

    const [jobReceipt] = getJobReceiptPda(registryState, currentJobCounter);

    const hashArray = Array.from(artifactHash.slice(0, 32));
    while (hashArray.length < 32) hashArray.push(0);

    let paymentTxBytes: number[];
    try {
      const decoded = Buffer.from(paymentTx, 'base64');
      paymentTxBytes = Array.from(decoded.slice(0, 64));
    } catch {
      paymentTxBytes = Array.from(Buffer.from(paymentTx, 'utf-8').slice(0, 64));
    }
    while (paymentTxBytes.length < 64) paymentTxBytes.push(0);

    const client = clientPubkey
      ? new PublicKey(clientPubkey)
      : agentWallet;

    const tx: string = await (registryProgram.methods as any)
      .recordJob(hashArray, new anchor.BN(paymentAmount), paymentTxBytes)
      .accounts({
        registryState,
        jobReceipt,
        agentWallet,
        client,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`Job recorded: id=${currentJobCounter.toString()}, tx: ${tx}`);
    return { txSignature: tx, jobId: currentJobCounter.toNumber() };
  } catch (err) {
    console.error('Job recording failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
