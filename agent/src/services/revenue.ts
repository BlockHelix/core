import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import { VAULT_PROGRAM_ID, REGISTRY_PROGRAM_ID, USDC_MINT, RPC_URL } from '../config';

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

function getVaultPda(operator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), operator.toBuffer()],
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
    const operator = agentKeypair.publicKey;

    const [vaultState] = getVaultPda(operator);
    const vaultUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, vaultState, true);
    const payerUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, operator);

    const connection = new Connection(RPC_URL, 'confirmed');
    const vaultInfo = await connection.getAccountInfo(vaultState);
    if (!vaultInfo) {
      console.log('[revenue] Vault not initialized, skipping');
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
  artifactHash: Buffer,
  paymentAmount: number,
  paymentTx: string,
  clientPubkey?: string,
): Promise<{ txSignature: string; jobId: number } | null> {
  try {
    const agentKeypair = loadAgentKeypair();
    const provider = getProvider(agentKeypair);
    anchor.setProvider(provider);
    const operator = agentKeypair.publicKey;

    const [vaultState] = getVaultPda(operator);
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
      console.log('[receipt] Registry not initialized, skipping');
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

    const client = clientPubkey ? new PublicKey(clientPubkey) : operator;

    const tx: string = await (registryProgram.methods as any)
      .recordJob(hashArray, new anchor.BN(paymentAmount), paymentTxBytes)
      .accounts({
        registryState,
        jobReceipt,
        operator,
        client,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`[receipt] Recorded job ${currentJobCounter.toString()}, tx: ${tx}`);
    return { txSignature: tx, jobId: currentJobCounter.toNumber() };
  } catch (err) {
    console.error('[receipt] Failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
