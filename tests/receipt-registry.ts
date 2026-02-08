import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorError } from "@coral-xyz/anchor";
import { ReceiptRegistry } from "../target/types/receipt_registry";
import { AgentVault } from "../target/types/agent_vault";
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("receipt-registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registryProgram = anchor.workspace.ReceiptRegistry as Program<ReceiptRegistry>;
  const vaultProgram = anchor.workspace.AgentVault as Program<AgentVault>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const agentWallet = Keypair.generate();
  const clientWallet = Keypair.generate();
  const protocolAuthority = Keypair.generate();

  let usdcMint: PublicKey;
  let registryState: PublicKey;
  let vaultState: PublicKey;
  let shareMint: PublicKey;
  let vaultUsdcAccount: PublicKey;
  let operatorShareAccount: PublicKey;

  const CHALLENGE_WINDOW = 3;
  const AGENT_FEE_BPS = 7000;
  const PROTOCOL_FEE_BPS = 500;
  const MAX_TVL = new BN(1_000_000_000_000);
  const LOCKUP_EPOCHS = 0;
  const EPOCH_LENGTH = new BN(86400);
  const PAYMENT_AMOUNT = 10_000_000;
  const NONCE = 0;

  const artifactHash = Buffer.alloc(32, 1);
  const paymentTx = Buffer.alloc(64, 2);
  const reasonHash = Buffer.alloc(32, 3);

  function jobReceiptPda(registryKey: PublicKey, jobId: number): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("job"),
        registryKey.toBuffer(),
        new BN(jobId).toArrayLike(Buffer, "le", 8),
      ],
      registryProgram.programId
    );
    return pda;
  }

  async function recordJob(jobId: number): Promise<PublicKey> {
    const jobReceipt = jobReceiptPda(registryState, jobId);
    await registryProgram.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        signer: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();
    return jobReceipt;
  }

  before(async () => {
    const sigs = await Promise.all([
      connection.requestAirdrop(agentWallet.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(clientWallet.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(protocolAuthority.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
    ]);
    for (const sig of sigs) await connection.confirmTransaction(sig);

    usdcMint = await createMint(connection, payer, payer.publicKey, null, 6);

    [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentWallet.publicKey.toBuffer(), new BN(NONCE).toArrayLike(Buffer, "le", 8)],
      vaultProgram.programId
    );
    [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      vaultProgram.programId
    );
    vaultUsdcAccount = getAssociatedTokenAddressSync(usdcMint, vaultState, true);

    [registryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), vaultState.toBuffer()],
      registryProgram.programId
    );
  });

  it("initializes vault (needed for registry)", async () => {
    await vaultProgram.methods
      .initialize(
        AGENT_FEE_BPS,
        PROTOCOL_FEE_BPS,
        MAX_TVL,
        LOCKUP_EPOCHS,
        EPOCH_LENGTH,
        protocolAuthority.publicKey,
        new BN(NONCE)
      )
      .accountsPartial({
        vaultState,
        shareMint,
        operator: agentWallet.publicKey,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const state = await vaultProgram.account.vaultState.fetch(vaultState);
    expect(state.operator.toString()).to.equal(agentWallet.publicKey.toString());
  });

  it("initializes registry", async () => {
    await registryProgram.methods
      .initializeRegistry(new BN(CHALLENGE_WINDOW))
      .accountsPartial({
        registryState,
        vault: vaultState,
        protocolAuthority: protocolAuthority.publicKey,
        operator: agentWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const state = await registryProgram.account.registryState.fetch(registryState);
    expect(state.vault.toString()).to.equal(vaultState.toString());
    expect(state.operator.toString()).to.equal(agentWallet.publicKey.toString());
    expect(state.protocolAuthority.toString()).to.equal(protocolAuthority.publicKey.toString());
    expect(state.jobCounter.toNumber()).to.equal(0);
    expect(state.challengeWindow.toNumber()).to.equal(CHALLENGE_WINDOW);
  });

  it("records a job", async () => {
    const jobReceipt = await recordJob(0);

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(receipt.registry.toString()).to.equal(registryState.toString());
    expect(receipt.jobId.toNumber()).to.equal(0);
    expect(receipt.client.toString()).to.equal(clientWallet.publicKey.toString());
    expect(receipt.paymentAmount.toNumber()).to.equal(PAYMENT_AMOUNT);
    expect(JSON.stringify(receipt.status)).to.equal(JSON.stringify({ active: {} }));
    expect(receipt.challengedAt.toNumber()).to.equal(0);

    const state = await registryProgram.account.registryState.fetch(registryState);
    expect(state.jobCounter.toNumber()).to.equal(1);
  });

  it("finalizes job after challenge window expires", async () => {
    const jobReceipt = await recordJob(1);
    await sleep((CHALLENGE_WINDOW + 2) * 1000);

    await registryProgram.methods
      .finalizeJob(new BN(1))
      .accountsPartial({
        registryState,
        jobReceipt,
      })
      .rpc();

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(JSON.stringify({ finalized: {} }));
  });

  it("rejects finalize when challenge window is still active", async () => {
    const jobReceipt = await recordJob(2);

    try {
      await registryProgram.methods
        .finalizeJob(new BN(2))
        .accountsPartial({
          registryState,
          jobReceipt,
        })
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("ChallengeWindowActive");
    }
  });

  it("challenges a job within window", async () => {
    const jobReceipt = await recordJob(3);

    await registryProgram.methods
      .challengeJob(Array.from(reasonHash))
      .accountsPartial({
        registryState,
        jobReceipt,
        challenger: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(JSON.stringify({ challenged: {} }));
    expect(receipt.challenger.toString()).to.equal(clientWallet.publicKey.toString());
    expect(receipt.challengedAt.toNumber()).to.be.greaterThan(0);

    const state = await registryProgram.account.registryState.fetch(registryState);
    expect(state.totalChallenged.toNumber()).to.equal(1);
  });

  it("rejects challenge after window expires", async () => {
    const jobReceipt = await recordJob(4);
    await sleep((CHALLENGE_WINDOW + 2) * 1000);

    try {
      await registryProgram.methods
        .challengeJob(Array.from(reasonHash))
        .accountsPartial({
          registryState,
          jobReceipt,
          challenger: clientWallet.publicKey,
        })
        .signers([clientWallet])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("ChallengeWindowExpired");
    }
  });

  it("resolves challenge for agent", async () => {
    const jobReceipt = await recordJob(5);

    // Challenge first
    await registryProgram.methods
      .challengeJob(Array.from(reasonHash))
      .accountsPartial({
        registryState,
        jobReceipt,
        challenger: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    await registryProgram.methods
      .resolveForAgent(new BN(5))
      .accountsPartial({
        registryState,
        jobReceipt,
        authority: protocolAuthority.publicKey,
      })
      .signers([protocolAuthority])
      .rpc();

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(JSON.stringify({ resolved: {} }));
    expect(receipt.resolvedAt.toNumber()).to.be.greaterThan(0);
  });

  it("resolves challenge against agent", async () => {
    const jobReceipt = await recordJob(6);

    await registryProgram.methods
      .challengeJob(Array.from(reasonHash))
      .accountsPartial({
        registryState,
        jobReceipt,
        challenger: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    await registryProgram.methods
      .resolveAgainstAgent(new BN(6))
      .accountsPartial({
        registryState,
        jobReceipt,
        authority: protocolAuthority.publicKey,
      })
      .signers([protocolAuthority])
      .rpc();

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(JSON.stringify({ rejected: {} }));
    expect(receipt.resolvedAt.toNumber()).to.be.greaterThan(0);

    const state = await registryProgram.account.registryState.fetch(registryState);
    expect(state.totalResolvedAgainst.toNumber()).to.equal(1);
  });

  it("rejects resolve_for_agent on non-challenged job", async () => {
    const jobReceipt = await recordJob(7);

    try {
      await registryProgram.methods
        .resolveForAgent(new BN(7))
        .accountsPartial({
          registryState,
          jobReceipt,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("JobNotChallenged");
    }
  });

  it("client verifies a receipt", async () => {
    const jobReceipt = jobReceiptPda(registryState, 0);

    await registryProgram.methods
      .verifyReceipt(new BN(0))
      .accountsPartial({
        jobReceipt,
        client: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(receipt.clientVerified).to.equal(true);
  });

  it("rejects verify from non-client", async () => {
    const jobReceipt = jobReceiptPda(registryState, 7);

    try {
      await registryProgram.methods
        .verifyReceipt(new BN(7))
        .accountsPartial({
          jobReceipt,
          client: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("rejects double verification", async () => {
    const jobReceipt = jobReceiptPda(registryState, 0);

    try {
      await registryProgram.methods
        .verifyReceipt(new BN(0))
        .accountsPartial({
          jobReceipt,
          client: clientWallet.publicKey,
        })
        .signers([clientWallet])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("AlreadyVerified");
    }
  });

  it("rejects record_job from non-operator", async () => {
    const jobReceipt = jobReceiptPda(registryState, 8);

    try {
      await registryProgram.methods
        .recordJob(
          Array.from(artifactHash),
          new BN(PAYMENT_AMOUNT),
          Array.from(paymentTx)
        )
        .accountsPartial({
          registryState,
          jobReceipt,
          signer: clientWallet.publicKey,
          client: clientWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([clientWallet])
        .rpc();
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.error?.errorCode?.code || err.message).to.include("Unauthorized");
    }
  });

  it("rejects challenge from non-client", async () => {
    const jobReceipt = await recordJob(8);

    try {
      await registryProgram.methods
        .challengeJob(Array.from(reasonHash))
        .accountsPartial({
          registryState,
          jobReceipt,
          challenger: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("Unauthorized");
    }
  });
});
