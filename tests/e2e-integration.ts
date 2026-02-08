import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AgentFactory } from "../target/types/agent_factory";
import { AgentVault } from "../target/types/agent_vault";
import { ReceiptRegistry } from "../target/types/receipt_registry";
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("e2e-integration: full BlockHelix flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const factoryProgram = anchor.workspace.AgentFactory as Program<AgentFactory>;
  const vaultProgram = anchor.workspace.AgentVault as Program<AgentVault>;
  const registryProgram = anchor.workspace.ReceiptRegistry as Program<ReceiptRegistry>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const deployer = Keypair.generate();
  const agent = Keypair.generate();
  const investor = Keypair.generate();
  const client = Keypair.generate();
  const arbitrator = Keypair.generate();

  let usdcMint: PublicKey;
  let factoryState: PublicKey;
  let agentMetadata: PublicKey;
  let vaultState: PublicKey;
  let shareMint: PublicKey;
  let vaultUsdcAccount: PublicKey;
  let registryState: PublicKey;
  let agentUsdcAccount: PublicKey;
  let investorUsdcAccount: PublicKey;
  let investorShareAccount: PublicKey;
  let protocolUsdcAccount: PublicKey;
  let depositRecord: PublicKey;
  let operatorShareAccount: PublicKey;
  let currentAgentCount: number;

  const AGENT_FEE_BPS = 7000;
  const PROTOCOL_FEE_BPS = 500;
  const VAULT_FEE_BPS = 10_000 - AGENT_FEE_BPS - PROTOCOL_FEE_BPS;
  const MIN_PROTOCOL_FEE_BPS = 500;
  const CHALLENGE_WINDOW = new BN(3);
  const MAX_TVL = new BN(1_000_000_000_000);
  const LOCKUP_EPOCHS = 1;
  const EPOCH_LENGTH = new BN(4);

  const VIRTUAL_SHARES = 1_000_000;
  const VIRTUAL_ASSETS = 1_000_000;

  const BOND_AMOUNT = 100_000_000;
  const DEPOSIT_AMOUNT = 100_000_000;
  const REVENUE_AMOUNT = 10_000_000;
  const INITIAL_INVESTOR_USDC = 500_000_000;

  let sharesReceived: number;

  before(async () => {
    const sigs = await Promise.all([
      connection.requestAirdrop(deployer.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(agent.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(investor.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(client.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(arbitrator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
    ]);
    for (const sig of sigs) {
      await connection.confirmTransaction(sig);
    }

    usdcMint = await createMint(connection, payer, payer.publicKey, null, 6);

    [factoryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      factoryProgram.programId
    );

    protocolUsdcAccount = await createAccount(connection, payer, usdcMint, deployer.publicKey);
    agentUsdcAccount = await createAccount(connection, payer, usdcMint, agent.publicKey);
    investorUsdcAccount = await createAccount(connection, payer, usdcMint, investor.publicKey);

    await mintTo(connection, payer, usdcMint, agentUsdcAccount, payer, 300_000_000);
    await mintTo(connection, payer, usdcMint, investorUsdcAccount, payer, INITIAL_INVESTOR_USDC);
  });

  it("Step 1: Initialize factory (or use existing)", async () => {
    let factoryExists = false;
    try {
      const existing = await factoryProgram.account.factoryState.fetch(factoryState);
      currentAgentCount = existing.agentCount.toNumber();
      factoryExists = true;
      console.log("    Factory already exists (from other test suite), agent_count:", currentAgentCount);
    } catch {
      factoryExists = false;
    }

    if (!factoryExists) {
      await factoryProgram.methods
        .initializeFactory(MIN_PROTOCOL_FEE_BPS)
        .accountsPartial({
          factoryState,
          authority: deployer.publicKey,
          protocolTreasury: protocolUsdcAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();
      currentAgentCount = 0;
      console.log("    Factory initialized fresh");
    }

    const factory = await factoryProgram.account.factoryState.fetch(factoryState);
    expect(factory.agentCount.toNumber()).to.equal(currentAgentCount);
    console.log("      factory_state:", factoryState.toString());
  });

  it("Step 2: Create agent via factory CPI", async () => {
    const agentId = currentAgentCount;

    [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agent.publicKey.toBuffer(), new BN(agentId).toArrayLike(Buffer, "le", 8)],
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

    investorShareAccount = getAssociatedTokenAddressSync(shareMint, investor.publicKey);

    [depositRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit"),
        vaultState.toBuffer(),
        investor.publicKey.toBuffer(),
      ],
      vaultProgram.programId
    );

    await factoryProgram.methods
      .createAgent(
        "DefiData Patch Agent",
        "blockhelix",
        "https://agent.blockhelix.io/api",
        AGENT_FEE_BPS,
        PROTOCOL_FEE_BPS,
        CHALLENGE_WINDOW,
        MAX_TVL,
        LOCKUP_EPOCHS,
        EPOCH_LENGTH,
        arbitrator.publicKey,
        null
      )
      .accountsPartial({
        factoryState,
        agentMetadata,
        operator: agent.publicKey,
        vaultState,
        shareMint,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolUsdcAccount,
        registryState,
        vaultProgram: vaultProgram.programId,
        registryProgram: registryProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    const factory = await factoryProgram.account.factoryState.fetch(factoryState);
    expect(factory.agentCount.toNumber()).to.equal(agentId + 1);

    const metadata = await factoryProgram.account.agentMetadata.fetch(agentMetadata);
    expect(metadata.name).to.equal("DefiData Patch Agent");
    expect(metadata.githubHandle).to.equal("blockhelix");
    expect(metadata.endpointUrl).to.equal("https://agent.blockhelix.io/api");
    expect(metadata.operator.toString()).to.equal(agent.publicKey.toString());
    expect(metadata.vault.toString()).to.equal(vaultState.toString());
    expect(metadata.registry.toString()).to.equal(registryState.toString());
    expect(metadata.shareMint.toString()).to.equal(shareMint.toString());
    expect(metadata.isActive).to.equal(true);

    const vault = await vaultProgram.account.vaultState.fetch(vaultState);
    expect(vault.operator.toString()).to.equal(agent.publicKey.toString());
    expect(vault.agentFeeBps).to.equal(AGENT_FEE_BPS);
    expect(vault.protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
    expect(vault.protocolTreasury.toString()).to.equal(protocolUsdcAccount.toString());

    const registry = await registryProgram.account.registryState.fetch(registryState);
    expect(registry.operator.toString()).to.equal(agent.publicKey.toString());
    expect(registry.vault.toString()).to.equal(vaultState.toString());
    expect(registry.jobCounter.toNumber()).to.equal(0);

    console.log("    Agent created via CPI");
    console.log("      vault_state:", vaultState.toString());
    console.log("      registry_state:", registryState.toString());
    console.log("      share_mint:", shareMint.toString());
  });

  it("Step 2b: Operator deposits to meet minimum shares", async () => {
    operatorShareAccount = await createAssociatedTokenAccount(
      connection, payer, shareMint, agent.publicKey
    );

    const [operatorDepositRecord] = PublicKey.findProgramAddressSync(
      [Buffer.from("deposit"), vaultState.toBuffer(), agent.publicKey.toBuffer()],
      vaultProgram.programId
    );

    await vaultProgram.methods
      .deposit(new BN(BOND_AMOUNT), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: agent.publicKey,
        depositorUsdcAccount: agentUsdcAccount,
        depositorShareAccount: operatorShareAccount,
        operatorShareAccount,
        depositRecord: operatorDepositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(BOND_AMOUNT);

    console.log("    Operator deposited:", BOND_AMOUNT / 1_000_000, "USDC");
  });

  it("Step 3: Investor deposits USDC into vault", async () => {
    await vaultProgram.methods
      .deposit(new BN(DEPOSIT_AMOUNT), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        depositor: investor.publicKey,
        depositorUsdcAccount: investorUsdcAccount,
        depositorShareAccount: investorShareAccount,
        operatorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    // shares = deposit * (totalShares + virtualShares) / (totalAssets + virtualAssets)
    // After operator deposited BOND_AMOUNT, the vault has shares and assets
    const operatorShares = await getAccount(connection, operatorShareAccount);
    const totalSharesBefore = Number(operatorShares.amount);
    const expectedShares = Math.floor(
      (DEPOSIT_AMOUNT * (totalSharesBefore + VIRTUAL_SHARES)) / (BOND_AMOUNT + VIRTUAL_ASSETS)
    );

    const shares = await getAccount(connection, investorShareAccount);
    sharesReceived = Number(shares.amount);
    expect(sharesReceived).to.equal(expectedShares);

    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdc.amount)).to.equal(BOND_AMOUNT + DEPOSIT_AMOUNT);

    console.log("    Deposited:", DEPOSIT_AMOUNT / 1_000_000, "USDC");
    console.log("    Shares received:", sharesReceived);
    console.log("    Vault total USDC:", Number(vaultUsdc.amount) / 1_000_000);
  });

  it("Step 4: Simulate x402 payment to agent", async () => {
    const agentUsdc = await getAccount(connection, agentUsdcAccount);
    const agentBalance = Number(agentUsdc.amount);
    // Agent started with 300M, staked 100M bond => 200M remaining
    expect(agentBalance).to.equal(300_000_000 - BOND_AMOUNT);

    console.log("    Agent USDC balance:", agentBalance / 1_000_000, "(simulated x402 payments)");
  });

  it("Step 5: Agent routes revenue to vault (fee split)", async () => {
    const vaultUsdcBefore = await getAccount(connection, vaultUsdcAccount);
    const vaultBalanceBefore = Number(vaultUsdcBefore.amount);

    const protocolBefore = await getAccount(connection, protocolUsdcAccount);
    const protocolBalanceBefore = Number(protocolBefore.amount);

    const agentBefore = await getAccount(connection, agentUsdcAccount);
    const agentBalanceBefore = Number(agentBefore.amount);

    await vaultProgram.methods
      .receiveRevenue(new BN(REVENUE_AMOUNT), new BN(1))
      .accountsPartial({
        vaultState,
        payer: agent.publicKey,
        vaultUsdcAccount,
        payerUsdcAccount: agentUsdcAccount,
        protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const expectedProtocolCut = Math.floor(REVENUE_AMOUNT * PROTOCOL_FEE_BPS / 10_000);
    const expectedVaultCut = Math.floor(REVENUE_AMOUNT * VAULT_FEE_BPS / 10_000);
    // Agent keeps the rest (amount stays in their account minus protocol_cut and vault_cut transfers)

    const vaultUsdcAfter = await getAccount(connection, vaultUsdcAccount);
    expect(Number(vaultUsdcAfter.amount)).to.equal(vaultBalanceBefore + expectedVaultCut);

    const protocolAfter = await getAccount(connection, protocolUsdcAccount);
    expect(Number(protocolAfter.amount)).to.equal(protocolBalanceBefore + expectedProtocolCut);

    const agentAfter = await getAccount(connection, agentUsdcAccount);
    const agentSpent = agentBalanceBefore - Number(agentAfter.amount);
    expect(agentSpent).to.equal(expectedProtocolCut + expectedVaultCut);

    const vault = await vaultProgram.account.vaultState.fetch(vaultState);
    expect(vault.totalRevenue.toNumber()).to.equal(REVENUE_AMOUNT);
    expect(vault.totalJobs.toNumber()).to.equal(1);

    console.log("    Revenue routed:", REVENUE_AMOUNT / 1_000_000, "USDC");
    console.log("      Agent keeps:", (REVENUE_AMOUNT - expectedProtocolCut - expectedVaultCut) / 1_000_000, "USDC (70%)");
    console.log("      Protocol cut:", expectedProtocolCut / 1_000_000, "USDC (5%)");
    console.log("      Vault cut:", expectedVaultCut / 1_000_000, "USDC (25%)");
    console.log("    Vault total USDC:", Number(vaultUsdcAfter.amount) / 1_000_000);
  });

  it("Step 6: Agent records job on registry", async () => {
    const artifactHash = Buffer.alloc(32);
    Buffer.from("sha256:patch-diff-for-issue-42").copy(artifactHash);

    const paymentTx = Buffer.alloc(64);
    Buffer.from("simulated-x402-payment-signature").copy(paymentTx);

    const jobId = 0;
    const [jobReceipt] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("job"),
        registryState.toBuffer(),
        new BN(jobId).toArrayLike(Buffer, "le", 8),
      ],
      registryProgram.programId
    );

    await registryProgram.methods
      .recordJob(
        Array.from(artifactHash),
        new BN(REVENUE_AMOUNT),
        Array.from(paymentTx)
      )
      .accountsPartial({
        registryState,
        jobReceipt,
        signer: agent.publicKey,
        client: client.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    const receipt = await registryProgram.account.jobReceipt.fetch(jobReceipt);
    expect(receipt.registry.toString()).to.equal(registryState.toString());
    expect(receipt.jobId.toNumber()).to.equal(0);
    expect(receipt.client.toString()).to.equal(client.publicKey.toString());
    expect(receipt.paymentAmount.toNumber()).to.equal(REVENUE_AMOUNT);
    expect(JSON.stringify(receipt.status)).to.equal(JSON.stringify({ active: {} }));

    const registry = await registryProgram.account.registryState.fetch(registryState);
    expect(registry.jobCounter.toNumber()).to.equal(1);

    console.log("    Job #0 recorded on registry");
    console.log("      payment_amount:", REVENUE_AMOUNT / 1_000_000, "USDC");
    console.log("      status: Active");
  });

  it("Step 7: Verify vault NAV increased (share price > 1.0)", async () => {
    const vaultUsdc = await getAccount(connection, vaultUsdcAccount);
    const totalAssets = Number(vaultUsdc.amount);

    const shareMintInfo = await getMint(connection, shareMint);
    const totalShares = Number(shareMintInfo.supply);

    const navPerShare = (totalAssets + VIRTUAL_ASSETS) / (totalShares + VIRTUAL_SHARES);
    expect(navPerShare).to.be.greaterThan(1.0);

    const expectedVaultCut = Math.floor(REVENUE_AMOUNT * VAULT_FEE_BPS / 10_000);
    expect(totalAssets).to.equal(BOND_AMOUNT + DEPOSIT_AMOUNT + expectedVaultCut);

    console.log("    Vault total assets:", totalAssets / 1_000_000, "USDC");
    console.log("    Share supply:", totalShares);
    console.log("    NAV per share:", navPerShare.toFixed(6));
  });

  it("Step 8: Investor withdraws shares with profit", async () => {
    console.log("    Waiting for lockup to expire (LOCKUP_EPOCHS=1, EPOCH_LENGTH=4s)...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const sharesBefore = await getAccount(connection, investorShareAccount);
    const sharesToBurn = Number(sharesBefore.amount);

    const vaultUsdcBefore = await getAccount(connection, vaultUsdcAccount);
    const totalAssets = Number(vaultUsdcBefore.amount);
    const mintInfo = await getMint(connection, shareMint);
    const totalShares = Number(mintInfo.supply);

    // usdc_out = shares * (totalAssets + virtualAssets) / (totalShares + virtualShares)
    const expectedUsdcOut = Math.floor(
      (sharesToBurn * (totalAssets + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES)
    );

    const investorUsdcBefore = await getAccount(connection, investorUsdcAccount);
    const investorBalanceBefore = Number(investorUsdcBefore.amount);

    await vaultProgram.methods
      .withdraw(new BN(sharesToBurn), new BN(0))
      .accountsPartial({
        vaultState,
        shareMint,
        vaultUsdcAccount,
        withdrawer: investor.publicKey,
        withdrawerUsdcAccount: investorUsdcAccount,
        withdrawerShareAccount: investorShareAccount,
        depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investor])
      .rpc();

    const investorUsdcAfter = await getAccount(connection, investorUsdcAccount);
    const investorBalanceAfter = Number(investorUsdcAfter.amount);

    expect(investorBalanceAfter).to.equal(investorBalanceBefore + expectedUsdcOut);

    const sharesAfter = await getAccount(connection, investorShareAccount);
    expect(Number(sharesAfter.amount)).to.equal(0);

    console.log("    Shares burned:", sharesToBurn);
    console.log("    USDC received:", expectedUsdcOut / 1_000_000);
    console.log("    Investor USDC after:", investorBalanceAfter / 1_000_000);
  });

  it("Step 9: Verify investor received more USDC than deposited", async () => {
    const investorUsdc = await getAccount(connection, investorUsdcAccount);
    const finalBalance = Number(investorUsdc.amount);

    // Investor started with INITIAL_INVESTOR_USDC, deposited DEPOSIT_AMOUNT
    // If profitable, finalBalance > INITIAL_INVESTOR_USDC
    const netReturn = finalBalance - (INITIAL_INVESTOR_USDC - DEPOSIT_AMOUNT);
    const profit = netReturn - DEPOSIT_AMOUNT;

    expect(netReturn).to.be.greaterThan(DEPOSIT_AMOUNT);
    expect(profit).to.be.greaterThan(0);
    expect(finalBalance).to.be.greaterThan(INITIAL_INVESTOR_USDC);

    const vault = await vaultProgram.account.vaultState.fetch(vaultState);
    expect(vault.totalRevenue.toNumber()).to.equal(REVENUE_AMOUNT);
    expect(vault.totalJobs.toNumber()).to.equal(1);
    expect(vault.totalRevenue.toNumber()).to.be.greaterThan(0);

    const registry = await registryProgram.account.registryState.fetch(registryState);
    expect(registry.jobCounter.toNumber()).to.equal(1);

    console.log("");
    console.log("    ========== E2E SUMMARY ==========");
    console.log("    Investor deposited:", DEPOSIT_AMOUNT / 1_000_000, "USDC");
    console.log("    Investor received: ", netReturn / 1_000_000, "USDC");
    console.log("    Profit:            ", profit / 1_000_000, "USDC");
    console.log("    Revenue routed:    ", REVENUE_AMOUNT / 1_000_000, "USDC");
    console.log("      Vault cut (25%): ", (REVENUE_AMOUNT * VAULT_FEE_BPS / 10_000) / 1_000_000, "USDC");
    console.log("      Protocol (5%):   ", (REVENUE_AMOUNT * PROTOCOL_FEE_BPS / 10_000) / 1_000_000, "USDC");
    console.log("      Agent (70%):     ", (REVENUE_AMOUNT * AGENT_FEE_BPS / 10_000) / 1_000_000, "USDC");
    console.log("    Jobs recorded:      1");
    console.log("    Agents created:     1");
    console.log("    ====================================");
  });
});
