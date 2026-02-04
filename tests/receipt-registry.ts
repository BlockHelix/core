import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorError } from "@coral-xyz/anchor";
import { ReceiptRegistry } from "../target/types/receipt_registry";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("receipt-registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ReceiptRegistry as Program<ReceiptRegistry>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const agentWallet = Keypair.generate();
  const clientWallet = Keypair.generate();
  const protocolAuthority = Keypair.generate();
  const vault = Keypair.generate();
  const nonClient = Keypair.generate();

  let registryState: PublicKey;
  const CHALLENGE_WINDOW = 3; // 3 seconds for tests

  const artifactHash = Buffer.alloc(32, 1);
  const paymentTx = Buffer.alloc(64, 2);
  const reasonHash = Buffer.alloc(32, 3);
  const PAYMENT_AMOUNT = 500_000; // $0.50

  function jobReceiptPda(registryKey: PublicKey, jobId: number): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("job"),
        registryKey.toBuffer(),
        new BN(jobId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    return pda;
  }

  before(async () => {
    const sigs = await Promise.all([
      connection.requestAirdrop(
        agentWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      connection.requestAirdrop(
        clientWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      connection.requestAirdrop(
        protocolAuthority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      connection.requestAirdrop(
        nonClient.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);
    for (const sig of sigs) {
      await connection.confirmTransaction(sig);
    }

    [registryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), vault.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initializes registry", async () => {
    await program.methods
      .initializeRegistry(new BN(CHALLENGE_WINDOW))
      .accountsPartial({
        registryState,
        vault: vault.publicKey,
        protocolAuthority: protocolAuthority.publicKey,
        agentWallet: agentWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const state = await program.account.registryState.fetch(registryState);
    expect(state.vault.toString()).to.equal(vault.publicKey.toString());
    expect(state.agentWallet.toString()).to.equal(
      agentWallet.publicKey.toString()
    );
    expect(state.protocolAuthority.toString()).to.equal(
      protocolAuthority.publicKey.toString()
    );
    expect(state.jobCounter.toNumber()).to.equal(0);
    expect(state.challengeWindow.toNumber()).to.equal(CHALLENGE_WINDOW);
    expect(state.totalChallenged.toNumber()).to.equal(0);
    expect(state.totalResolvedAgainst.toNumber()).to.equal(0);
  });

  it("records a job", async () => {
    const jobId = 0;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const receipt = await program.account.jobReceipt.fetch(jobReceipt);
    expect(receipt.registry.toString()).to.equal(registryState.toString());
    expect(receipt.jobId.toNumber()).to.equal(0);
    expect(receipt.client.toString()).to.equal(
      clientWallet.publicKey.toString()
    );
    expect(receipt.paymentAmount.toNumber()).to.equal(PAYMENT_AMOUNT);
    expect(JSON.stringify(receipt.status)).to.equal(
      JSON.stringify({ active: {} })
    );
    expect(receipt.challengedAt.toNumber()).to.equal(0);
    expect(receipt.resolvedAt.toNumber()).to.equal(0);
    expect(receipt.challenger.toString()).to.equal(
      PublicKey.default.toString()
    );

    const state = await program.account.registryState.fetch(registryState);
    expect(state.jobCounter.toNumber()).to.equal(1);
  });

  it("finalizes job after challenge window expires", async () => {
    // Record job #1
    const jobId = 1;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    // Wait for challenge window to expire
    await sleep((CHALLENGE_WINDOW + 2) * 1000);

    await program.methods
      .finalizeJob(new BN(jobId))
      .accountsPartial({
        registryState,
        jobReceipt,
      })
      .rpc();

    const receipt = await program.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(
      JSON.stringify({ finalized: {} })
    );
  });

  it("rejects finalize when challenge window is still active", async () => {
    // Record job #2
    const jobId = 2;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    try {
      await program.methods
        .finalizeJob(new BN(jobId))
        .accountsPartial({
          registryState,
          jobReceipt,
        })
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal(
        "ChallengeWindowActive"
      );
    }
  });

  it("challenges a job within window", async () => {
    // Record job #3
    const jobId = 3;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    await program.methods
      .challengeJob(Array.from(reasonHash))
      .accountsPartial({
        registryState,
        jobReceipt,
        challenger: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    const receipt = await program.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(
      JSON.stringify({ challenged: {} })
    );
    expect(receipt.challenger.toString()).to.equal(
      clientWallet.publicKey.toString()
    );
    expect(receipt.challengedAt.toNumber()).to.be.greaterThan(0);

    const state = await program.account.registryState.fetch(registryState);
    expect(state.totalChallenged.toNumber()).to.equal(1);
  });

  it("resolves challenge for agent", async () => {
    // Record job #4, challenge it, then resolve for agent
    const jobId = 4;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    await program.methods
      .challengeJob(Array.from(reasonHash))
      .accountsPartial({
        registryState,
        jobReceipt,
        challenger: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    await program.methods
      .resolveForAgent(new BN(jobId))
      .accountsPartial({
        registryState,
        jobReceipt,
        authority: protocolAuthority.publicKey,
      })
      .signers([protocolAuthority])
      .rpc();

    const receipt = await program.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(
      JSON.stringify({ resolved: {} })
    );
    expect(receipt.resolvedAt.toNumber()).to.be.greaterThan(0);

    const state = await program.account.registryState.fetch(registryState);
    expect(state.totalResolvedAgainst.toNumber()).to.equal(0);
  });

  it("resolves challenge against agent", async () => {
    // Record job #5, challenge it, then resolve against agent
    const jobId = 5;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    await program.methods
      .challengeJob(Array.from(reasonHash))
      .accountsPartial({
        registryState,
        jobReceipt,
        challenger: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    await program.methods
      .resolveAgainstAgent(new BN(jobId))
      .accountsPartial({
        registryState,
        jobReceipt,
        authority: protocolAuthority.publicKey,
      })
      .signers([protocolAuthority])
      .rpc();

    const receipt = await program.account.jobReceipt.fetch(jobReceipt);
    expect(JSON.stringify(receipt.status)).to.equal(
      JSON.stringify({ rejected: {} })
    );
    expect(receipt.resolvedAt.toNumber()).to.be.greaterThan(0);

    const state = await program.account.registryState.fetch(registryState);
    expect(state.totalResolvedAgainst.toNumber()).to.equal(1);
  });

  it("rejects challenge after window expires", async () => {
    // Record job #6, wait for window, then try to challenge
    const jobId = 6;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    await sleep((CHALLENGE_WINDOW + 2) * 1000);

    try {
      await program.methods
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
      expect(anchorErr.error.errorCode.code).to.equal(
        "ChallengeWindowExpired"
      );
    }
  });

  it("rejects challenge from non-client", async () => {
    // Use job #0 which is still Active (was never finalized or challenged)
    const jobId = 0;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    try {
      await program.methods
        .challengeJob(Array.from(reasonHash))
        .accountsPartial({
          registryState,
          jobReceipt,
          challenger: nonClient.publicKey,
        })
        .signers([nonClient])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("client verifies a receipt", async () => {
    const jobId = 0;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    const receiptBefore = await program.account.jobReceipt.fetch(jobReceipt);
    expect(receiptBefore.clientVerified).to.equal(false);

    await program.methods
      .verifyReceipt(new BN(jobId))
      .accountsPartial({
        jobReceipt,
        client: clientWallet.publicKey,
      })
      .signers([clientWallet])
      .rpc();

    const receipt = await program.account.jobReceipt.fetch(jobReceipt);
    expect(receipt.clientVerified).to.equal(true);
  });

  it("rejects verify from non-client", async () => {
    // Record job #7 for this test
    const jobId = 7;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    await program.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(PAYMENT_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        agentWallet: agentWallet.publicKey,
        client: clientWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    try {
      await program.methods
        .verifyReceipt(new BN(jobId))
        .accountsPartial({
          jobReceipt,
          client: nonClient.publicKey,
        })
        .signers([nonClient])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      const anchorErr = err as AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("rejects double verification", async () => {
    const jobId = 0;
    const jobReceipt = jobReceiptPda(registryState, jobId);

    try {
      await program.methods
        .verifyReceipt(new BN(jobId))
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
});
