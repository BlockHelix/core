import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createHash } from 'crypto';
import fs from 'fs';
import { isKmsEnabled, getKmsPublicKey, signTransactionWithKms } from './kms-signer';

const VAULT_PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID || 'HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS'
);
const REGISTRY_PROGRAM_ID = new PublicKey(
  process.env.REGISTRY_PROGRAM_ID || 'jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9'
);
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

function getProvider(keypair: Keypair): anchor.AnchorProvider {
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  return new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}

function getVaultPda(operator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), operator.toBuffer()],
    VAULT_PROGRAM_ID
  );
}

function getRegistryPda(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), vault.toBuffer()],
    REGISTRY_PROGRAM_ID
  );
}

function getJobReceiptPda(registry: PublicKey, jobCounter: anchor.BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('job'), registry.toBuffer(), jobCounter.toArrayLike(Buffer, 'le', 8)],
    REGISTRY_PROGRAM_ID
  );
}

function loadIdl(idlPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
}

export function hashArtifact(data: string): Buffer {
  return createHash('sha256').update(data).digest();
}

export interface RevenueResult {
  txSignature: string;
  vaultState: string;
}

export interface ReceiptResult {
  txSignature: string;
  jobId: number;
}

export async function routeRevenueToVault(
  agentKeypair: Keypair,
  operatorPubkey: PublicKey,
  amount: number,
  jobId: number
): Promise<RevenueResult | null> {
  try {
    const provider = getProvider(agentKeypair);
    anchor.setProvider(provider);
    const operator = operatorPubkey;

    const [vaultState] = getVaultPda(operator);
    const vaultUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, vaultState, true);
    const payerUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, operator);

    const connection = new Connection(RPC_URL, 'confirmed');
    const vaultInfo = await connection.getAccountInfo(vaultState);
    if (!vaultInfo) {
      console.log('[revenue] Vault not initialized, skipping revenue routing');
      return null;
    }

    const vaultIdl = loadIdl(
      process.env.VAULT_IDL_PATH || `${process.cwd()}/../target/idl/agent_vault.json`
    );
    const vaultProgram = new anchor.Program(vaultIdl as anchor.Idl, provider);

    const vaultAccount = await (vaultProgram.account as any).vaultState.fetch(vaultState);
    const protocolTreasury = vaultAccount.protocolTreasury as PublicKey;
    const protocolUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, protocolTreasury);

    const tx: string = await (vaultProgram.methods as any)
      .receiveRevenue(new anchor.BN(amount), new anchor.BN(jobId))
      .accounts({
        vaultState,
        payer: operator,
        vaultUsdcAccount,
        payerUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`[revenue] Routed ${amount} micro-USDC, job ${jobId}, tx: ${tx}`);
    return { txSignature: tx, vaultState: vaultState.toBase58() };
  } catch (err) {
    console.error('[revenue] Failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function recordJobOnChain(
  agentKeypair: Keypair | null,
  operatorPubkey: PublicKey,
  artifactHash: Buffer,
  paymentAmount: number,
  paymentTx: string,
  clientPubkey?: string
): Promise<ReceiptResult | null> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const useKms = isKmsEnabled();
    const signerPubkey = useKms ? getKmsPublicKey()! : agentKeypair!.publicKey;

    if (!signerPubkey) {
      console.log('[receipt] No signer available (no keypair and KMS not enabled)');
      return null;
    }

    const dummyKeypair = agentKeypair || Keypair.generate();
    const provider = getProvider(dummyKeypair);
    anchor.setProvider(provider);

    const [vaultState] = getVaultPda(operatorPubkey);
    const [registryState] = getRegistryPda(vaultState);

    const registryInfo = await connection.getAccountInfo(registryState);
    if (!registryInfo) {
      console.log('[receipt] Registry not initialized, skipping job recording');
      return null;
    }

    const registryIdl = loadIdl(
      process.env.REGISTRY_IDL_PATH || `${process.cwd()}/../target/idl/receipt_registry.json`
    );
    const registryProgram = new anchor.Program(registryIdl as anchor.Idl, provider);

    const registryAccount = await (registryProgram.account as any).registryState.fetch(registryState);
    const currentJobCounter = registryAccount.jobCounter as anchor.BN;

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

    const client = clientPubkey ? new PublicKey(clientPubkey) : signerPubkey;

    if (useKms) {
      const instruction = await (registryProgram.methods as any)
        .recordJob(hashArray, new anchor.BN(paymentAmount), paymentTxBytes)
        .accounts({
          registryState,
          jobReceipt,
          signer: signerPubkey,
          client,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: signerPubkey,
      }).add(instruction);

      const signedTx = await signTransactionWithKms(transaction);
      const txSig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');

      console.log(`[receipt] Recorded job ${currentJobCounter.toString()} via KMS, tx: ${txSig}`);
      return { txSignature: txSig, jobId: currentJobCounter.toNumber() };
    } else {
      const tx: string = await (registryProgram.methods as any)
        .recordJob(hashArray, new anchor.BN(paymentAmount), paymentTxBytes)
        .accounts({
          registryState,
          jobReceipt,
          signer: signerPubkey,
          client,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`[receipt] Recorded job ${currentJobCounter.toString()}, tx: ${tx}`);
      return { txSignature: tx, jobId: currentJobCounter.toNumber() };
    }
  } catch (err) {
    console.error('[receipt] Failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
