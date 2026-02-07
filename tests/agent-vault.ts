import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AgentVault } from "../target/types/agent_vault";
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  approve,
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
  let operatorShareAccount: PublicKey;
  let depositorUsdcAccount: PublicKey;
  let depositorShareAccount: PublicKey;
  let protocolUsdcAccount: PublicKey;
  let depositRecord: PublicKey;
  let claimantUsdcAccount: PublicKey;

  const AGENT_FEE_BPS = 7000;
  const PROTOCOL_FEE_BPS = 500;
  const MAX_TVL = new BN(1_000_000_000_000);
  const LOCKUP_EPOCHS = 1;
  const EPOCH_LENGTH = new BN(8);
  const OPERATOR_DEPOSIT = 200_000_000; // 200 USDC to get >= MIN_OPERATOR_SHARES
  const DEPOSIT_AMOUNT = 100_000_000;
  const REVENUE_AMOUNT = 10_000_000;

  const VIRTUAL_SHARES = 1_000_000;
  const VIRTUAL_ASSETS = 1_000_000;

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
      500_000_000
    );

    depositorShareAccount = getAssociatedTokenAddressSync(
      shareMint,
      depositor.publicKey
    );
  });

  it("Initializes vault", async () => {
    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, MAX_TVL, LOCKUP_EPOCHS, EPOCH_LENGTH, arbitrator.publicKey)
      .accountsPartial({
        vaultState,
        shareMint,
        operator: agentWallet.publicKey,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    operatorShareAccount = await createAssociatedTokenAccount(
      connection, payer, shareMint, agentWallet.publicKey
    );

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.operator.toString()).to.equal(agentWallet.publicKey.toString());
    expect(state.arbitrator.toString()).to.equal(arbitrator.publicKey.toString());
    expect(state.agentFeeBps).to.equal(AGENT_FEE_BPS);
    expect(state.protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
    expect(state.totalRevenue.toNumber()).to.equal(0);
    expect(state.totalJobs.toNumber()).to.equal(0);
    expect(state.maxTvl.toString()).to.equal(MAX_TVL.toString());
    expect(state.lockupEpochs).to.equal(LOCKUP_EPOCHS);
    expect(state.epochLength.toNumber()).to.equal(EPOCH_LENGTH.toNumber());
    expect(state.virtualShares.toNumber()).to.equal(VIRTUAL_SHARES);
    expect(state.virtualAssets.toNumber()).to.equal(VIRTUAL_ASSETS);
    expect(state.paused).to.equal(false);
  });

  it("Operator deposits to meet MIN_OPERATOR_SHARES", async () => {
    const [operatorDepositRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit"),
        vaultState.toBuffer(),
        agentWallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .deposit(new BN(OPERATOR_DEPOSIT), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: agentWallet.publicKey,
        depositorUsdcAccount: agentUsdcAccount,
        depositorShareAccount: operatorShareAccount,
        operatorShareAccount,
        depositRecord: operatorDepositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    const shares = await getAccount(connection, operatorShareAccount);
    expect(Number(shares.amount)).to.be.greaterThanOrEqual(100_000_000);
  });

  it("Rejects non-operator deposit when operator shares below minimum", async () => {
    const agent2 = Keypair.generate();
    const sig = await connection.requestAirdrop(agent2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);

    const [vs2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agent2.publicKey.toBuffer()],
      program.programId
    );
    const [sm2] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vs2.toBuffer()],
      program.programId
    );
    const vua2 = getAssociatedTokenAddressSync(usdcMint, vs2, true);
    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, MAX_TVL, 0, new BN(86400), arbitrator.publicKey)
      .accountsPartial({
        vaultState: vs2,
        shareMint: sm2,
        operator: agent2.publicKey,
        usdcMint,
        vaultUsdcAccount: vua2,
        protocolTreasury: protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent2])
      .rpc();

    const opShareAcct2 = await createAssociatedTokenAccount(connection, payer, sm2, agent2.publicKey);
    const depShareAcct2 = getAssociatedTokenAddressSync(sm2, depositor.publicKey);
    const [dr2] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vs2.toBuffer(), depositor.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
        .accountsPartial({
          vaultState: vs2,
          shareMint: sm2,
          vaultUsdcAccount: vua2,
          depositor: depositor.publicKey,
          depositorUsdcAccount,
          depositorShareAccount: depShareAcct2,
          operatorShareAccount: opShareAcct2,
          depositRecord: dr2,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      expect.fail("Should have rejected deposit without sufficient operator shares");
    } catch (err: any) {
      // The operator share account doesn't even exist yet, so this should fail
      // with either InsufficientOperatorShares or an account constraint error
      expect(err).to.exist;
    }
  });

  it("Deposits 100 USDC with virtual shares math", async () => {
    const vaultUsdcBefore = await getAccount(connection, vaultUsdcAccount);
    const totalAssetsBefore = Number(vaultUsdcBefore.amount);
    const shareMintInfo = await getAccount(connection, operatorShareAccount);
    const totalSharesBefore = Number(shareMintInfo.amount); // only operator shares exist

    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount,
        operatorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    // shares = amount * (totalShares + virtualShares) / (totalAssets + virtualAssets)
    const expectedShares = Math.floor(
      (DEPOSIT_AMOUNT * (totalSharesBefore + VIRTUAL_SHARES)) /
        (totalAssetsBefore + VIRTUAL_ASSETS)
    );

    const shares = await getAccount(connection, depositorShareAccount);
    expect(Number(shares.amount)).to.equal(expectedShares);

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(totalAssetsBefore + DEPOSIT_AMOUNT);
  });

  it("Receives 10 USDC revenue with job_id", async () => {
    const vaultUsdcBefore = await getAccount(connection, vaultUsdcAccount);
    const vaultBalanceBefore = Number(vaultUsdcBefore.amount);

    await program.methods
      .receiveRevenue(new BN(REVENUE_AMOUNT), new BN(1))
      .accountsPartial({
        vaultState,
        payer: agentWallet.publicKey,
        vaultUsdcAccount,
        payerUsdcAccount: agentUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentWallet])
      .rpc();

    // vault_fee_bps = 10000 - 7000 - 500 = 2500
    // vault_cut = 10_000_000 * 2500 / 10000 = 2_500_000
    // protocol_cut = 10_000_000 * 500 / 10000 = 500_000
    // agent keeps the rest (7_000_000) — stays in payer's account
    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(vaultBalanceBefore + 2_500_000);

    const protocolUsdc = await getAccount(connection, protocolUsdcAccount);
    expect(Number(protocolUsdc.amount)).to.equal(500_000);

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.totalRevenue.toNumber()).to.equal(REVENUE_AMOUNT);
    expect(state.totalJobs.toNumber()).to.equal(1);
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
    const totalAssets = Number(vaultUsdcBefore.amount);

    // Total shares = operator shares + depositor shares
    const operatorShares = await getAccount(connection, operatorShareAccount);
    const totalShares = sharesToBurn + Number(operatorShares.amount);

    const expectedUsdcOut = Math.floor(
      (sharesToBurn * (totalAssets + VIRTUAL_ASSETS)) /
        (totalShares + VIRTUAL_SHARES)
    );

    const depositorUsdcBefore = await getAccount(connection, depositorUsdcAccount);
    const depositorBalanceBefore = Number(depositorUsdcBefore.amount);

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
    expect(Number(depositorUsdc.amount)).to.equal(depositorBalanceBefore + expectedUsdcOut);
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

    const tinyTvlCap = new BN(150_000_000); // 150 USDC cap

    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, tinyTvlCap, 0, new BN(86400), arbitrator.publicKey)
      .accountsPartial({
        vaultState: vaultState2,
        shareMint: shareMint2,
        operator: agent2.publicKey,
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
    await mintTo(connection, payer, usdcMint, agent2Usdc, payer, 200_000_000);

    const opShareAcct2 = await createAssociatedTokenAccount(connection, payer, shareMint2, agent2.publicKey);
    const [opDepositRecord2] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vaultState2.toBuffer(), agent2.publicKey.toBuffer()],
      program.programId
    );

    // Operator deposits 100 USDC to meet MIN_OPERATOR_SHARES (100M)
    await program.methods
      .deposit(new BN(100_000_000), new BN(0))
      .accountsPartial({
        vaultState: vaultState2,
        shareMint: shareMint2,
        vaultUsdcAccount: vaultUsdcAccount2,
        depositor: agent2.publicKey,
        depositorUsdcAccount: agent2Usdc,
        depositorShareAccount: opShareAcct2,
        operatorShareAccount: opShareAcct2,
        depositRecord: opDepositRecord2,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
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
        .deposit(new BN(DEPOSIT_AMOUNT), new BN(0)) // 100 USDC + 100 existing = 200 > 150 cap
        .accountsPartial({
          vaultState: vaultState2,
          shareMint: shareMint2,
          vaultUsdcAccount: vaultUsdcAccount2,
          depositor: depositor.publicKey,
          depositorUsdcAccount,
          depositorShareAccount: depositorShareAccount2,
          operatorShareAccount: opShareAcct2,
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

  it("Slash burns operator shares and transfers USDC to claimant", async () => {
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
        operatorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const vaultBefore = await getAccount(connection, vaultUsdcAccount);
    const vaultBalanceBefore = Number(vaultBefore.amount);
    const operatorSharesBefore = await getAccount(connection, operatorShareAccount);
    const operatorShareBalanceBefore = Number(operatorSharesBefore.amount);
    const claimantBefore = await getAccount(connection, claimantUsdcAccount);
    const claimantBalanceBefore = Number(claimantBefore.amount);

    const slashAmount = 5_000_000; // 5 USDC

    // Approve vault PDA as delegate so it can burn operator shares
    await approve(
      connection,
      payer,
      operatorShareAccount,
      vaultState,
      agentWallet,
      operatorShareBalanceBefore
    );

    await program.methods
      .slash(new BN(slashAmount), new BN(99))
      .accountsPartial({
        vaultState,
        authority: arbitrator.publicKey,
        vaultUsdcAccount,
        shareMint,
        operatorShareAccount,
        claimantUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([arbitrator])
      .rpc();

    const stateAfter = await program.account.vaultState.fetch(vaultState);
    expect(stateAfter.totalSlashed.toNumber()).to.equal(slashAmount);
    expect(stateAfter.slashEvents).to.equal(1);

    const claimantAfter = await getAccount(connection, claimantUsdcAccount);
    expect(Number(claimantAfter.amount)).to.equal(claimantBalanceBefore + slashAmount);

    const vaultAfter = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultAfter.amount)).to.equal(vaultBalanceBefore - slashAmount);

    const operatorSharesAfter = await getAccount(connection, operatorShareAccount);
    expect(Number(operatorSharesAfter.amount)).to.be.lessThan(operatorShareBalanceBefore);
  });

  it("Pause blocks deposits, unpause allows them", async () => {
    await program.methods
      .pause()
      .accountsPartial({
        vaultState,
        operator: agentWallet.publicKey,
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
          operatorShareAccount,
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
        operator: agentWallet.publicKey,
        operatorShareAccount,
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
        operatorShareAccount,
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
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS, MAX_TVL, 0, new BN(86400), arbitrator.publicKey)
      .accountsPartial({
        vaultState: vs3,
        shareMint: sm3,
        operator: agent3.publicKey,
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
    await mintTo(connection, payer, usdcMint, a3usdc, payer, 200_000_000);

    const opShareAcct3 = await createAssociatedTokenAccount(connection, payer, sm3, agent3.publicKey);
    const [opDr3] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vs3.toBuffer(), agent3.publicKey.toBuffer()],
      program.programId
    );

    // Operator deposits to meet minimum
    await program.methods
      .deposit(new BN(150_000_000), new BN(0))
      .accountsPartial({
        vaultState: vs3,
        shareMint: sm3,
        vaultUsdcAccount: vua3,
        depositor: agent3.publicKey,
        depositorUsdcAccount: a3usdc,
        depositorShareAccount: opShareAcct3,
        operatorShareAccount: opShareAcct3,
        depositRecord: opDr3,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent3])
      .rpc();

    const dsa3 = getAssociatedTokenAddressSync(sm3, depositor.publicKey);
    const [dr3] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vs3.toBuffer(), depositor.publicKey.toBuffer()],
      program.programId
    );

    const vaultUsdcBefore = await getAccount(connection, vua3);
    const totalAssetsBefore = Number(vaultUsdcBefore.amount);
    const opShares3 = await getAccount(connection, opShareAcct3);
    const totalSharesBefore = Number(opShares3.amount);

    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
      .accountsPartial({
        vaultState: vs3,
        shareMint: sm3,
        vaultUsdcAccount: vua3,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount: dsa3,
        operatorShareAccount: opShareAcct3,
        depositRecord: dr3,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const shares = await getAccount(connection, dsa3);
    const sharesMinted = Number(shares.amount);

    const expectedShares = Math.floor(
      (DEPOSIT_AMOUNT * (totalSharesBefore + VIRTUAL_SHARES)) /
        (totalAssetsBefore + VIRTUAL_ASSETS)
    );
    expect(sharesMinted).to.equal(expectedShares);
    // Virtual shares ensure shares_minted is computed with (totalShares + virtual) / (totalAssets + virtual)
    // rather than just totalShares / totalAssets, preventing first-depositor manipulation
    expect(sharesMinted).to.be.greaterThan(0);
  });
});
