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

  let usdcMint: PublicKey;
  let vaultState: PublicKey;
  let shareMint: PublicKey;
  let vaultUsdcAccount: PublicKey;
  let agentUsdcAccount: PublicKey;
  let depositorUsdcAccount: PublicKey;
  let depositorShareAccount: PublicKey;
  let protocolUsdcAccount: PublicKey;

  const AGENT_FEE_BPS = 7000;
  const PROTOCOL_FEE_BPS = 500;
  const DEPOSIT_AMOUNT = 100_000_000; // 100 USDC (6 decimals)
  const REVENUE_AMOUNT = 10_000_000; // 10 USDC

  before(async () => {
    // Fund agent wallet and depositor
    const sig1 = await connection.requestAirdrop(
      agentWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const sig2 = await connection.requestAirdrop(
      depositor.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig1);
    await connection.confirmTransaction(sig2);

    // Create USDC mock mint
    usdcMint = await createMint(connection, payer, payer.publicKey, null, 6);

    // Derive PDAs
    [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentWallet.publicKey.toBuffer()],
      program.programId
    );
    [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      program.programId
    );
    vaultUsdcAccount = getAssociatedTokenAddressSync(usdcMint, vaultState, true);

    // Create token accounts
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

    // Mint USDC to depositor and agent
    await mintTo(
      connection,
      payer,
      usdcMint,
      depositorUsdcAccount,
      payer,
      DEPOSIT_AMOUNT
    );
    await mintTo(
      connection,
      payer,
      usdcMint,
      agentUsdcAccount,
      payer,
      REVENUE_AMOUNT
    );

    depositorShareAccount = getAssociatedTokenAddressSync(
      shareMint,
      depositor.publicKey
    );
  });

  it("Initializes vault", async () => {
    await program.methods
      .initialize(AGENT_FEE_BPS, PROTOCOL_FEE_BPS)
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
    expect(state.agentFeeBps).to.equal(AGENT_FEE_BPS);
    expect(state.protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
    expect(state.totalRevenue.toNumber()).to.equal(0);
    expect(state.totalJobs.toNumber()).to.equal(0);
  });

  it("Deposits 100 USDC", async () => {
    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: depositor.publicKey,
        depositorUsdcAccount,
        depositorShareAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(DEPOSIT_AMOUNT);

    const shares = await getAccount(connection, depositorShareAccount);
    expect(Number(shares.amount)).to.equal(DEPOSIT_AMOUNT); // 1:1 first deposit
  });

  it("Receives 10 USDC revenue", async () => {
    await program.methods
      .receiveRevenue(new BN(REVENUE_AMOUNT))
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
        vaultUsdcAccount,
        agentUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agentWallet])
      .rpc();

    // vault_fee_bps = 10000 - 7000 - 500 = 2500
    // vault_cut = 10_000_000 * 2500 / 10000 = 2_500_000
    // protocol_cut = 10_000_000 * 500 / 10000 = 500_000
    // agent keeps the rest (stays in agent account)

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(DEPOSIT_AMOUNT + 2_500_000);

    const protocolUsdc = await getAccount(connection, protocolUsdcAccount);
    expect(Number(protocolUsdc.amount)).to.equal(500_000);

    // Agent should have: REVENUE_AMOUNT - vault_cut - protocol_cut = 10M - 2.5M - 0.5M = 7M
    const agentUsdc = await getAccount(connection, agentUsdcAccount);
    expect(Number(agentUsdc.amount)).to.equal(7_000_000);

    const state = await program.account.vaultState.fetch(vaultState);
    expect(state.totalRevenue.toNumber()).to.equal(REVENUE_AMOUNT);
    expect(state.totalJobs.toNumber()).to.equal(1);
  });

  it("Withdraws all shares → 102.5 USDC", async () => {
    const sharesBefore = await getAccount(connection, depositorShareAccount);
    const sharesToBurn = Number(sharesBefore.amount);

    await program.methods
      .withdraw(new BN(sharesToBurn))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        withdrawer: depositor.publicKey,
        withdrawerUsdcAccount: depositorUsdcAccount,
        withdrawerShareAccount: depositorShareAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    // 100M shares * 102.5M usdc / 100M total_shares = 102_500_000
    const depositorUsdc = await getAccount(connection, depositorUsdcAccount);
    expect(Number(depositorUsdc.amount)).to.equal(102_500_000);

    const sharesAfter = await getAccount(connection, depositorShareAccount);
    expect(Number(sharesAfter.amount)).to.equal(0);

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(0);
  });
});
