import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AgentVault } from "../target/types/agent_vault";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("agent-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentVault as Program<AgentVault>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const agentWallet = Keypair.generate();
  const depositor = Keypair.generate();
  const protocolTreasury = Keypair.generate();
  const claimant = Keypair.generate();
  const arbitrator = Keypair.generate();

  let usdcMint: PublicKey;
  let vaultState: PublicKey;
  let shareMint: PublicKey;
  let vaultUsdcAccount: PublicKey;
  let agentUsdcAccount: PublicKey;
  let depositorUsdcAccount: PublicKey;
  let depositorShareAccount: PublicKey;
  let protocolUsdcAccount: PublicKey;
  let depositRecord: PublicKey;
  let claimantUsdcAccount: PublicKey;
  let arbitratorUsdcAccount: PublicKey;

  const AGENT_FEE_BPS = 7000;
  const PROTOCOL_FEE_BPS = 500;
  const MAX_TVL = new BN(1_000_000_000_000);
  const LOCKUP_EPOCHS = 1;
  const EPOCH_LENGTH = new BN(8);
  const BOND_AMOUNT = 100_000_000; // 100 USDC = MIN_OPERATOR_BOND
  const DEPOSIT_AMOUNT = 100_000_000;
  const REVENUE_AMOUNT = 10_000_000;

  const VIRTUAL_SHARES = 1_000_000;
  const VIRTUAL_ASSETS = 1_000_000;
  const TARGET_APY_BPS = 1000; // 10%
  const LENDING_FLOOR_BPS = 800; // 8%

  before(async () => {
    const sig1 = await connection.requestAirdrop(
      agentWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const sig2 = await connection.requestAirdrop(
      depositor.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const sig3 = await connection.requestAirdrop(
      claimant.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const sig4 = await connection.requestAirdrop(
      arbitrator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig1);
    await connection.confirmTransaction(sig2);
    await connection.confirmTransaction(sig3);
    await connection.confirmTransaction(sig4);

    usdcMint = await createMint(connection, payer, payer.publicKey, null, 6);

    [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentWallet.publicKey.toBuffer()],
      program.programId
    );
    [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      program.programId
    );
    vaultUsdcAccount = getAssociatedTokenAddressSync(usdcMint, vaultState, true);

    [depositRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit"),
        vaultState.toBuffer(),
        depositor.publicKey.toBuffer(),
      ],
      program.programId
    );

    agentUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      agentWallet.publicKey
    );
    depositorUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      depositor.publicKey
    );
    protocolUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      protocolTreasury.publicKey
    );
    claimantUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      claimant.publicKey
    );
    arbitratorUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      arbitrator.publicKey
    );

    await mintTo(
      connection,
      payer,
      usdcMint,
      depositorUsdcAccount,
      payer,
      500_000_000
    );
    await mintTo(
      connection,
      payer,
      usdcMint,
      agentUsdcAccount,
      payer,
      200_000_000 // 200 USDC for bond + revenue
    );

    depositorShareAccount = getAssociatedTokenAddressSync(
      shareMint,
      depositor.publicKey
    );
  });

  it("Initializes vault with v2 params", async () => {
    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, MAX_TVL, LOCKUP_EPOCHS, EPOCH_LENGTH, TARGET_APY_BPS, LENDING_FLOOR_BPS, arbitrator.publicKey)
      .accountsPartial({
        vaultState,
        shareMint,
        agentWallet: agentWallet.publicKey,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.agentWallet.toString()).to.equal(
      agentWallet.publicKey.toString()
    );
    expect(state.arbitrator.toString()).to.equal(
      arbitrator.publicKey.toString()
    );
    expect(state.agentFeeBps).to.equal(AGENT_FEE_BPS);
    expect(state.protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
    expect(state.totalRevenue.toNumber()).to.equal(0);
    expect(state.totalJobs.toNumber()).to.equal(0);
    expect(state.operatorBond.toNumber()).to.equal(0);
    expect(state.maxTvl.toString()).to.equal(MAX_TVL.toString());
    expect(state.lockupEpochs).to.equal(LOCKUP_EPOCHS);
    expect(state.epochLength.toNumber()).to.equal(EPOCH_LENGTH.toNumber());
    expect(state.virtualShares.toNumber()).to.equal(VIRTUAL_SHARES);
    expect(state.virtualAssets.toNumber()).to.equal(VIRTUAL_ASSETS);
    expect(state.paused).to.equal(false);
    expect(state.navHighWaterMark.toNumber()).to.equal(1_000_000);
    expect(state.targetApyBps).to.equal(TARGET_APY_BPS);
    expect(state.lendingFloorBps).to.equal(LENDING_FLOOR_BPS);
  });

  it("Rejects deposit when bond below minimum", async () => {
    try {
      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
        .accountsPartial({
          vaultState,
          shareMint,
          vaultUsdcAccount,
          depositor: depositor.publicKey,
          depositorUsdcAccount,
          depositorShareAccount,
          depositRecord,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      expect.fail("Should have rejected deposit without sufficient bond");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InsufficientBond");
    }
  });

  it("Rejects deposit when bond is staked but below minimum", async () => {
    // Stake 10 USDC (below MIN_OPERATOR_BOND of 100 USDC)
    await program.methods
      .stakeBond(new BN(10_000_000))
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
        vaultUsdcAccount,
        agentUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentWallet])
      .rpc();

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.operatorBond.toNumber()).to.equal(10_000_000);

    try {
      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
        .accountsPartial({
          vaultState,
          shareMint,
          vaultUsdcAccount,
          depositor: depositor.publicKey,
          depositorUsdcAccount,
          depositorShareAccount,
          depositRecord,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      expect.fail("Should have rejected deposit with insufficient bond");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InsufficientBond");
    }
  });

  it("Stakes operator bond to minimum and accepts deposits", async () => {
    // Stake remaining 90 USDC to reach 100 USDC minimum
    await program.methods
      .stakeBond(new BN(90_000_000))
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
        vaultUsdcAccount,
        agentUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentWallet])
      .rpc();

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.operatorBond.toNumber()).to.equal(BOND_AMOUNT);

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(BOND_AMOUNT);
  });

  it("Deposits 100 USDC with virtual shares math", async () => {
    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    // shares = 100_000_000 * (0 + 1_000_000) / (100_000_000 + 1_000_000)
    // shares = 100_000_000 * 1_000_000 / 101_000_000 = 990_099
    const expectedShares = Math.floor(
      (DEPOSIT_AMOUNT * (0 + VIRTUAL_SHARES)) / (BOND_AMOUNT + VIRTUAL_ASSETS)
    );

    const shares = await getAccount(connection, depositorShareAccount);
    expect(Number(shares.amount)).to.equal(expectedShares);

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(DEPOSIT_AMOUNT + BOND_AMOUNT);

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.totalDeposited.toNumber()).to.equal(DEPOSIT_AMOUNT);
  });

  it("Receives 10 USDC revenue with job_id", async () => {
    await program.methods
      .receiveRevenue(new BN(REVENUE_AMOUNT), new BN(1))
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
        vaultUsdcAccount,
        shareMint,
        agentUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentWallet])
      .rpc();

    // vault_cut = 10_000_000 * 2500 / 10000 = 2_500_000
    // protocol_cut = 10_000_000 * 500 / 10000 = 500_000
    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(
      DEPOSIT_AMOUNT + BOND_AMOUNT + 2_500_000
    );

    const protocolUsdc = await getAccount(connection, protocolUsdcAccount);
    expect(Number(protocolUsdc.amount)).to.equal(500_000);

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.totalRevenue.toNumber()).to.equal(REVENUE_AMOUNT);
    expect(state.totalJobs.toNumber()).to.equal(1);
    expect(state.navHighWaterMark.toNumber()).to.be.greaterThan(0);
  });

  it("Rejects withdrawal before lockup expires", async () => {
    const shares = await getAccount(connection, depositorShareAccount);
    try {
      await program.methods
        .withdraw(new BN(Number(shares.amount)), new BN(0))
        .accountsPartial({
          vaultState,
          shareMint,
          vaultUsdcAccount,
          withdrawer: depositor.publicKey,
          withdrawerUsdcAccount: depositorUsdcAccount,
          withdrawerShareAccount: depositorShareAccount,
          depositRecord,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([depositor])
        .rpc();
      expect.fail("Should have rejected withdrawal before lockup");
    } catch (err: any) {
      if (!err.error?.errorCode) throw err;
      expect(err.error.errorCode.code).to.equal("LockupNotExpired");
    }
  });

  it("Withdraws after lockup expires", async () => {
    await new Promise((resolve) => setTimeout(resolve, 9000));

    const sharesBefore = await getAccount(connection, depositorShareAccount);
    const sharesToBurn = Number(sharesBefore.amount);
    const vaultUsdcBefore = await getAccount(connection, vaultUsdcAccount);
    const vaultBalance = Number(vaultUsdcBefore.amount);

    const state = await program.account.vaultState.fetch(vaultState);
    const totalShares = sharesToBurn;
    const totalAssets = vaultBalance;

    const expectedUsdcOut = Math.floor(
      (sharesToBurn * (totalAssets + VIRTUAL_ASSETS)) /
        (totalShares + VIRTUAL_SHARES)
    );

    await program.methods
      .withdraw(new BN(sharesToBurn), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        withdrawer: depositor.publicKey,
        withdrawerUsdcAccount: depositorUsdcAccount,
        withdrawerShareAccount: depositorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    const depositorUsdc = await getAccount(connection, depositorUsdcAccount);
    expect(Number(depositorUsdc.amount)).to.equal(
      500_000_000 - DEPOSIT_AMOUNT + expectedUsdcOut
    );

    try {
      await getAccount(connection, depositorShareAccount);
      expect.fail("Share account should have been closed");
    } catch (err: any) {
      expect(err.name).to.equal("TokenAccountNotFoundError");
    }

    const stateAfter = await program.account.vaultState.fetch(vaultState);
    expect(stateAfter.totalWithdrawn.toNumber()).to.equal(expectedUsdcOut);
  });

  it("TVL cap enforcement", async () => {
    const agent2 = Keypair.generate();
    const sig = await connection.requestAirdrop(
      agent2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const [vaultState2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agent2.publicKey.toBuffer()],
      program.programId
    );
    const [shareMint2] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState2.toBuffer()],
      program.programId
    );
    const vaultUsdcAccount2 = getAssociatedTokenAddressSync(
      usdcMint,
      vaultState2,
      true
    );

    const tinyTvlCap = new BN(150_000_000); // 150 USDC cap (bond alone is 100)

    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, tinyTvlCap, 0, new BN(86400), TARGET_APY_BPS, LENDING_FLOOR_BPS, arbitrator.publicKey)
      .accountsPartial({
        vaultState: vaultState2,
        shareMint: shareMint2,
        agentWallet: agent2.publicKey,
        usdcMint,
        vaultUsdcAccount: vaultUsdcAccount2,
        protocolTreasury: protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent2])
      .rpc();

    const agent2Usdc = await createAccount(
      connection,
      payer,
      usdcMint,
      agent2.publicKey
    );
    await mintTo(connection, payer, usdcMint, agent2Usdc, payer, 100_000_000);

    await program.methods
      .stakeBond(new BN(100_000_000))
      .accountsPartial({
        vaultState: vaultState2,
        agentWallet: agent2.publicKey,
        vaultUsdcAccount: vaultUsdcAccount2,
        agentUsdcAccount: agent2Usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent2])
      .rpc();

    const depositorShareAccount2 = getAssociatedTokenAddressSync(
      shareMint2,
      depositor.publicKey
    );
    const [depositRecord2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit"),
        vaultState2.toBuffer(),
        depositor.publicKey.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT), new BN(0)) // 100 USDC + 100 bond = 200 > 150 cap
        .accountsPartial({
          vaultState: vaultState2,
          shareMint: shareMint2,
          vaultUsdcAccount: vaultUsdcAccount2,
          depositor: depositor.publicKey,
          depositorUsdcAccount,
          depositorShareAccount: depositorShareAccount2,
          depositRecord: depositRecord2,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      expect.fail("Should have rejected deposit exceeding TVL cap");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("TVLCapExceeded");
    }
  });

  it("Dynamic TVL cap tightens after revenue is recorded", async () => {
    const agentDyn = Keypair.generate();
    const depositorDyn = Keypair.generate();
    const sigs = await Promise.all([
      connection.requestAirdrop(agentDyn.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(depositorDyn.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
    ]);
    for (const s of sigs) await connection.confirmTransaction(s);

    const [vsDyn] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentDyn.publicKey.toBuffer()],
      program.programId
    );
    const [smDyn] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vsDyn.toBuffer()],
      program.programId
    );
    const vuaDyn = getAssociatedTokenAddressSync(usdcMint, vsDyn, true);

    // Large fixed cap so only the dynamic cap constrains deposits.
    // 50% target APY, 0% lending floor => 50% spread.
    // This makes the dynamic cap = annual_depositor_rev / 0.50
    const largeCap = new BN(10_000_000_000_000);
    const highTargetApy = 5000;   // 50%
    const zeroFloor = 0;          // 0%
    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, largeCap, 0, new BN(86400), highTargetApy, zeroFloor, arbitrator.publicKey)
      .accountsPartial({
        vaultState: vsDyn,
        shareMint: smDyn,
        agentWallet: agentDyn.publicKey,
        usdcMint,
        vaultUsdcAccount: vuaDyn,
        protocolTreasury: protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentDyn])
      .rpc();

    const stateInit = await program.account.vaultState.fetch(vsDyn);
    expect(stateInit.targetApyBps).to.equal(highTargetApy);
    expect(stateInit.lendingFloorBps).to.equal(zeroFloor);
    expect(stateInit.totalRevenue.toNumber()).to.equal(0);

    const agentDynUsdc = await createAccount(connection, payer, usdcMint, agentDyn.publicKey);
    await mintTo(connection, payer, usdcMint, agentDynUsdc, payer, 200_000_000);

    const depositorDynUsdc = await createAccount(connection, payer, usdcMint, depositorDyn.publicKey);
    await mintTo(connection, payer, usdcMint, depositorDynUsdc, payer, 500_000_000);

    await program.methods
      .stakeBond(new BN(100_000_000))
      .accountsPartial({
        vaultState: vsDyn,
        agentWallet: agentDyn.publicKey,
        vaultUsdcAccount: vuaDyn,
        agentUsdcAccount: agentDynUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentDyn])
      .rpc();

    const depositorShareDyn = getAssociatedTokenAddressSync(smDyn, depositorDyn.publicKey);
    const [depositRecordDyn] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vsDyn.toBuffer(), depositorDyn.publicKey.toBuffer()],
      program.programId
    );

    // Bootstrapping deposit works (no revenue => uses fixed cap)
    await program.methods
      .deposit(new BN(10_000_000), new BN(0))
      .accountsPartial({
        vaultState: vsDyn,
        shareMint: smDyn,
        vaultUsdcAccount: vuaDyn,
        depositor: depositorDyn.publicKey,
        depositorUsdcAccount: depositorDynUsdc,
        depositorShareAccount: depositorShareDyn,
        depositRecord: depositRecordDyn,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositorDyn])
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Record near-zero revenue: 1 micro-USDC.
    // vault_fee_bps = 10000 - 7000 - 500 = 2500, target=50%, floor=0%, spread=50%
    // With ~2s elapsed:
    //   annual_depositor_rev = 1 * 2500 * 31_536_000 / 10_000 / 2 = 3_942_000
    //   dynamic_cap = 3_942_000 * 10_000 / 5000 = 7_884_000 (~$7.88)
    // Vault holds ~110M (bond + deposit). 110M >> 7.8M => deposit rejected.
    await program.methods
      .receiveRevenue(new BN(1), new BN(1))
      .accountsPartial({
        vaultState: vsDyn,
        agentWallet: agentDyn.publicKey,
        vaultUsdcAccount: vuaDyn,
        shareMint: smDyn,
        agentUsdcAccount: agentDynUsdc,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentDyn])
      .rpc();

    const stateAfterRev = await program.account.vaultState.fetch(vsDyn);
    expect(stateAfterRev.totalRevenue.toNumber()).to.equal(1);

    // Any additional deposit should now fail because the vault balance
    // already exceeds the dynamic cap.
    try {
      await program.methods
        .deposit(new BN(1_000_000), new BN(0))
        .accountsPartial({
          vaultState: vsDyn,
          shareMint: smDyn,
          vaultUsdcAccount: vuaDyn,
          depositor: depositorDyn.publicKey,
          depositorUsdcAccount: depositorDynUsdc,
          depositorShareAccount: depositorShareDyn,
          depositRecord: depositRecordDyn,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositorDyn])
        .rpc();
      expect.fail("Should have rejected deposit exceeding dynamic TVL cap");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("TVLCapExceeded");
    }
  });

  it("Slash 2x with three-way distribution from operator bond", async () => {
    // Re-deposit into original vault for slash test
    await program.methods
      .deposit(new BN(50_000_000), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const stateBefore = await program.account.vaultState.fetch(vaultState);
    const bondBefore = stateBefore.operatorBond.toNumber();
    const vaultBefore = await getAccount(connection, vaultUsdcAccount);
    const vaultBalanceBefore = Number(vaultBefore.amount);

    const claimantBefore = await getAccount(connection, claimantUsdcAccount);
    const claimantBalanceBefore = Number(claimantBefore.amount);
    const arbitratorBefore = await getAccount(connection, arbitratorUsdcAccount);
    const arbitratorBalanceBefore = Number(arbitratorBefore.amount);
    const protocolBefore = await getAccount(connection, protocolUsdcAccount);
    const protocolBalanceBefore = Number(protocolBefore.amount);

    // Slash with amount = 3_000_000 (job payment). Total slash = 6_000_000 (2x)
    const jobPayment = 3_000_000;
    const totalSlash = jobPayment * 2; // 6_000_000
    const expectedClient = Math.floor(totalSlash * 7500 / 10000); // 4_500_000
    const expectedArbitrator = Math.floor(totalSlash * 1000 / 10000); // 600_000
    const expectedProtocol = totalSlash - expectedClient - expectedArbitrator; // 900_000

    await program.methods
      .slash(new BN(jobPayment), new BN(99))
      .accountsPartial({
        vaultState,
        authority: arbitrator.publicKey,
        vaultUsdcAccount,
        claimantUsdcAccount,
        arbitratorUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([arbitrator])
      .rpc();

    const stateAfter = await program.account.vaultState.fetch(vaultState);
    // total_slash (6M) <= bond (100M), so all from bond
    expect(stateAfter.operatorBond.toNumber()).to.equal(bondBefore - totalSlash);
    expect(stateAfter.totalSlashed.toNumber()).to.equal(totalSlash);
    expect(stateAfter.slashEvents).to.equal(1);

    const claimantAfter = await getAccount(connection, claimantUsdcAccount);
    expect(Number(claimantAfter.amount)).to.equal(claimantBalanceBefore + expectedClient);

    const arbitratorAfter = await getAccount(connection, arbitratorUsdcAccount);
    expect(Number(arbitratorAfter.amount)).to.equal(arbitratorBalanceBefore + expectedArbitrator);

    const protocolAfter = await getAccount(connection, protocolUsdcAccount);
    expect(Number(protocolAfter.amount)).to.equal(protocolBalanceBefore + expectedProtocol);

    const vaultAfter = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultAfter.amount)).to.equal(vaultBalanceBefore - totalSlash);
  });

  it("Slash waterfall into depositor pool when total_slash > operator_bond", async () => {
    const stateBefore = await program.account.vaultState.fetch(vaultState);
    const bondBefore = stateBefore.operatorBond.toNumber();
    // bondBefore = 100M - 6M = 94M after previous slash

    const claimantBefore = await getAccount(connection, claimantUsdcAccount);
    const claimantBalanceBefore = Number(claimantBefore.amount);
    const arbitratorBefore = await getAccount(connection, arbitratorUsdcAccount);
    const arbitratorBalanceBefore = Number(arbitratorBefore.amount);
    const protocolBefore = await getAccount(connection, protocolUsdcAccount);
    const protocolBalanceBefore = Number(protocolBefore.amount);

    // Slash with amount = 50_000_000 ($50 job). Total = 100_000_000 (2x)
    // Bond is 94M, so 94M from bond + 6M from depositor pool
    const jobPayment = 50_000_000;
    const totalSlash = jobPayment * 2; // 100_000_000
    const expectedClient = Math.floor(totalSlash * 7500 / 10000); // 75_000_000
    const expectedArbitrator = Math.floor(totalSlash * 1000 / 10000); // 10_000_000
    const expectedProtocol = totalSlash - expectedClient - expectedArbitrator; // 15_000_000
    const fromBond = Math.min(totalSlash, bondBefore); // 94_000_000
    const fromDepositors = totalSlash - fromBond; // 6_000_000

    await program.methods
      .slash(new BN(jobPayment), new BN(100))
      .accountsPartial({
        vaultState,
        authority: arbitrator.publicKey,
        vaultUsdcAccount,
        claimantUsdcAccount,
        arbitratorUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([arbitrator])
      .rpc();

    const stateAfter = await program.account.vaultState.fetch(vaultState);
    expect(stateAfter.operatorBond.toNumber()).to.equal(bondBefore - fromBond);
    expect(stateAfter.operatorBond.toNumber()).to.equal(0);
    expect(stateAfter.totalSlashed.toNumber()).to.equal(6_000_000 + totalSlash); // cumulative
    expect(stateAfter.slashEvents).to.equal(2);

    const claimantAfter = await getAccount(connection, claimantUsdcAccount);
    expect(Number(claimantAfter.amount)).to.equal(claimantBalanceBefore + expectedClient);

    const arbitratorAfter = await getAccount(connection, arbitratorUsdcAccount);
    expect(Number(arbitratorAfter.amount)).to.equal(arbitratorBalanceBefore + expectedArbitrator);

    const protocolAfter = await getAccount(connection, protocolUsdcAccount);
    expect(Number(protocolAfter.amount)).to.equal(protocolBalanceBefore + expectedProtocol);
  });

  it("Pause blocks deposits, unpause allows them", async () => {
    await mintTo(connection, payer, usdcMint, agentUsdcAccount, payer, 100_000_000);

    await program.methods
      .stakeBond(new BN(100_000_000))
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
        vaultUsdcAccount,
        agentUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentWallet])
      .rpc();

    await program.methods
      .pause()
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
      })
      .signers([agentWallet])
      .rpc();

    let state = await program.account.vaultState.fetch(vaultState);
    expect(state.paused).to.equal(true);

    try {
      await program.methods
        .deposit(new BN(1_000_000), new BN(0))
        .accountsPartial({
          vaultState,
          shareMint,
          vaultUsdcAccount,
          depositor: depositor.publicKey,
          depositorUsdcAccount,
          depositorShareAccount,
          depositRecord,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      expect.fail("Should have rejected deposit while paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("VaultPaused");
    }

    await program.methods
      .unpause()
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
      })
      .signers([agentWallet])
      .rpc();

    state = await program.account.vaultState.fetch(vaultState);
    expect(state.paused).to.equal(false);

    await program.methods
      .deposit(new BN(1_000_000), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();
  });

  it("Virtual shares prevent inflation attack", async () => {
    const agent3 = Keypair.generate();
    const sig = await connection.requestAirdrop(
      agent3.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const [vs3] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agent3.publicKey.toBuffer()],
      program.programId
    );
    const [sm3] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vs3.toBuffer()],
      program.programId
    );
    const vua3 = getAssociatedTokenAddressSync(usdcMint, vs3, true);

    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, MAX_TVL, 0, new BN(86400), TARGET_APY_BPS, LENDING_FLOOR_BPS, arbitrator.publicKey)
      .accountsPartial({
        vaultState: vs3,
        shareMint: sm3,
        agentWallet: agent3.publicKey,
        usdcMint,
        vaultUsdcAccount: vua3,
        protocolTreasury: protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent3])
      .rpc();

    const a3usdc = await createAccount(
      connection,
      payer,
      usdcMint,
      agent3.publicKey
    );
    await mintTo(connection, payer, usdcMint, a3usdc, payer, 100_000_000);

    await program.methods
      .stakeBond(new BN(100_000_000))
      .accountsPartial({
        vaultState: vs3,
        agentWallet: agent3.publicKey,
        vaultUsdcAccount: vua3,
        agentUsdcAccount: a3usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent3])
      .rpc();

    const dsa3 = getAssociatedTokenAddressSync(sm3, depositor.publicKey);
    const [dr3] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vs3.toBuffer(), depositor.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
      .accountsPartial({
        vaultState: vs3,
        shareMint: sm3,
        vaultUsdcAccount: vua3,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount: dsa3,
        depositRecord: dr3,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const shares = await getAccount(connection, dsa3);
    const sharesMinted = Number(shares.amount);

    // shares = 100M * (0 + 1M) / (100M + 1M) = 990_099
    const expectedShares = Math.floor(
      (DEPOSIT_AMOUNT * VIRTUAL_SHARES) / (100_000_000 + VIRTUAL_ASSETS)
    );
    expect(sharesMinted).to.equal(expectedShares);
    expect(sharesMinted).to.not.equal(DEPOSIT_AMOUNT);
  });
});
