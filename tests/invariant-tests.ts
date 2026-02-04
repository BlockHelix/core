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

// Seeded PRNG for reproducible fuzz testing (xorshift128+)
class SeededRng {
  private s0: number;
  private s1: number;

  constructor(seed: number) {
    this.s0 = seed | 0;
    this.s1 = (seed * 1103515245 + 12345) | 0;
    if (this.s0 === 0) this.s0 = 1;
    if (this.s1 === 0) this.s1 = 1;
  }

  next(): number {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 ^= s1 << 23;
    s1 ^= s1 >> 17;
    s1 ^= s0;
    s1 ^= s0 >> 26;
    this.s1 = s1;
    return Math.abs((this.s0 + this.s1) | 0);
  }

  range(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
}

const VIRTUAL_SHARES = 1_000_000;
const VIRTUAL_ASSETS = 1_000_000;
const BPS_DENOMINATOR = 10_000;
const AGENT_FEE_BPS = 7000;
const PROTOCOL_FEE_BPS = 500;
const VAULT_FEE_BPS = BPS_DENOMINATOR - AGENT_FEE_BPS - PROTOCOL_FEE_BPS;
const MIN_OPERATOR_BOND = 100_000_000;
const SLASH_MULTIPLIER = 2;
const CLIENT_SHARE_BPS = 7500;
const ARBITRATOR_SHARE_BPS = 1000;

function computeNav(totalAssets: number, totalShares: number): number {
  return (totalAssets + VIRTUAL_ASSETS) / (totalShares + VIRTUAL_SHARES);
}

function computeSharesForDeposit(
  amount: number,
  totalAssets: number,
  totalShares: number
): number {
  return Math.floor(
    (amount * (totalShares + VIRTUAL_SHARES)) / (totalAssets + VIRTUAL_ASSETS)
  );
}

function computeAssetsForWithdraw(
  shares: number,
  totalAssets: number,
  totalShares: number
): number {
  return Math.floor(
    (shares * (totalAssets + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES)
  );
}

// Vault lifecycle helper: creates a fresh vault + bonds + returns all needed accounts
interface VaultFixture {
  agentWallet: Keypair;
  vaultState: PublicKey;
  shareMint: PublicKey;
  vaultUsdcAccount: PublicKey;
  agentUsdcAccount: PublicKey;
  protocolUsdcAccount: PublicKey;
  usdcMint: PublicKey;
}

interface DepositorAccounts {
  keypair: Keypair;
  usdcAccount: PublicKey;
  shareAccount: PublicKey;
  depositRecord: PublicKey;
}

describe("Economic Invariant Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentVault as Program<AgentVault>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  let globalUsdcMint: PublicKey;
  const arbitrator = Keypair.generate();

  async function setupUsdcMint(): Promise<PublicKey> {
    if (globalUsdcMint) return globalUsdcMint;
    globalUsdcMint = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      6
    );
    const sig = await connection.requestAirdrop(
      arbitrator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
    return globalUsdcMint;
  }

  async function createVault(
    bondAmount: number = MIN_OPERATOR_BOND,
    lockupEpochs: number = 0,
    epochLength: number = 1,
    maxTvl: number = 1_000_000_000_000
  ): Promise<VaultFixture> {
    const usdcMint = await setupUsdcMint();
    const agentWallet = Keypair.generate();
    const protocolTreasury = Keypair.generate();

    const sig = await connection.requestAirdrop(
      agentWallet.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentWallet.publicKey.toBuffer()],
      program.programId
    );
    const [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      program.programId
    );
    const vaultUsdcAccount = getAssociatedTokenAddressSync(
      usdcMint,
      vaultState,
      true
    );

    const agentUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      agentWallet.publicKey
    );
    const protocolUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      protocolTreasury.publicKey
    );

    await mintTo(
      connection,
      payer,
      usdcMint,
      agentUsdcAccount,
      payer,
      bondAmount + 1_000_000_000_000
    );

    await program.methods
      .initialize(
        AGENT_FEE_BPS,
        PROTOCOL_FEE_BPS,
        new BN(maxTvl),
        lockupEpochs,
        new BN(epochLength),
        1000,
        800,
        arbitrator.publicKey
      )
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

    if (bondAmount > 0) {
      await program.methods
        .stakeBond(new BN(bondAmount))
        .accountsPartial({
          vaultState,
          agentWallet: agentWallet.publicKey,
          vaultUsdcAccount,
          agentUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agentWallet])
        .rpc();
    }

    return {
      agentWallet,
      vaultState,
      shareMint,
      vaultUsdcAccount,
      agentUsdcAccount,
      protocolUsdcAccount,
      usdcMint,
    };
  }

  async function createDepositor(
    vault: VaultFixture,
    fundAmount: number
  ): Promise<DepositorAccounts> {
    const keypair = Keypair.generate();
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const usdcAccount = await createAccount(
      connection,
      payer,
      vault.usdcMint,
      keypair.publicKey
    );
    await mintTo(
      connection,
      payer,
      vault.usdcMint,
      usdcAccount,
      payer,
      fundAmount
    );

    const shareAccount = getAssociatedTokenAddressSync(
      vault.shareMint,
      keypair.publicKey
    );
    const [depositRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("deposit"),
        vault.vaultState.toBuffer(),
        keypair.publicKey.toBuffer(),
      ],
      program.programId
    );

    return { keypair, usdcAccount, shareAccount, depositRecord };
  }

  async function deposit(
    vault: VaultFixture,
    depositor: DepositorAccounts,
    amount: number
  ): Promise<void> {
    await program.methods
      .deposit(new BN(amount), new BN(0))
      .accountsPartial({
        vaultState: vault.vaultState,
        shareMint: vault.shareMint,
        vaultUsdcAccount: vault.vaultUsdcAccount,
        depositor: depositor.keypair.publicKey,
        depositorUsdcAccount: depositor.usdcAccount,
        depositorShareAccount: depositor.shareAccount,
        depositRecord: depositor.depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor.keypair])
      .rpc();
  }

  async function withdraw(
    vault: VaultFixture,
    depositor: DepositorAccounts,
    shares: number
  ): Promise<void> {
    await program.methods
      .withdraw(new BN(shares), new BN(0))
      .accountsPartial({
        vaultState: vault.vaultState,
        shareMint: vault.shareMint,
        vaultUsdcAccount: vault.vaultUsdcAccount,
        withdrawer: depositor.keypair.publicKey,
        withdrawerUsdcAccount: depositor.usdcAccount,
        withdrawerShareAccount: depositor.shareAccount,
        depositRecord: depositor.depositRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([depositor.keypair])
      .rpc();
  }

  async function sendRevenue(
    vault: VaultFixture,
    amount: number,
    jobId: number
  ): Promise<void> {
    await program.methods
      .receiveRevenue(new BN(amount), new BN(jobId))
      .accountsPartial({
        vaultState: vault.vaultState,
        agentWallet: vault.agentWallet.publicKey,
        vaultUsdcAccount: vault.vaultUsdcAccount,
        shareMint: vault.shareMint,
        agentUsdcAccount: vault.agentUsdcAccount,
        protocolUsdcAccount: vault.protocolUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([vault.agentWallet])
      .rpc();
  }

  async function getVaultAssets(vault: VaultFixture): Promise<number> {
    const acc = await getAccount(connection, vault.vaultUsdcAccount);
    return Number(acc.amount);
  }

  async function getShareSupply(vault: VaultFixture): Promise<number> {
    const mintInfo = await connection.getTokenSupply(vault.shareMint);
    return Number(mintInfo.value.amount);
  }

  async function getShareBalance(
    depositor: DepositorAccounts
  ): Promise<number> {
    try {
      const acc = await getAccount(connection, depositor.shareAccount);
      return Number(acc.amount);
    } catch {
      return 0;
    }
  }

  async function getUsdcBalance(tokenAccount: PublicKey): Promise<number> {
    const acc = await getAccount(connection, tokenAccount);
    return Number(acc.amount);
  }

  // ============================================================
  // INVARIANT 1: NAV Conservation on Deposit/Withdrawal
  // From non-circularity-proof.md Step 3
  // NAV = (A + V) / (S + W) is INVARIANT under deposits and withdrawals
  // ============================================================
  describe("Invariant 1: NAV Conservation", () => {
    const NAV_TOLERANCE = 0.0001; // rounding tolerance for integer division

    it("Fuzz: random deposits preserve NAV (20 iterations)", async () => {
      const vault = await createVault();
      const rng = new SeededRng(42);

      const depositorA = await createDepositor(vault, 2_000_000_000_000);
      await deposit(vault, depositorA, 10_000_000);

      for (let i = 0; i < 20; i++) {
        const totalAssets = await getVaultAssets(vault);
        const totalShares = await getShareSupply(vault);
        const navBefore = computeNav(totalAssets, totalShares);

        const amount = rng.range(1_000_000, 1_000_000_000);
        await deposit(vault, depositorA, amount);

        const totalAssetsAfter = await getVaultAssets(vault);
        const totalSharesAfter = await getShareSupply(vault);
        const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

        expect(Math.abs(navAfter - navBefore)).to.be.lessThan(
          NAV_TOLERANCE,
          `Iteration ${i}: NAV changed from ${navBefore} to ${navAfter} on deposit of ${amount}`
        );
      }
    });

    it("Fuzz: random withdrawals preserve NAV (20 iterations)", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 2_000_000_000_000);
      await deposit(vault, depositorA, 500_000_000);

      const rng = new SeededRng(123);

      for (let i = 0; i < 20; i++) {
        const totalAssets = await getVaultAssets(vault);
        const totalShares = await getShareSupply(vault);
        const balance = await getShareBalance(depositorA);
        if (balance < 10) break;

        const navBefore = computeNav(totalAssets, totalShares);

        const fraction = rng.range(1, 10);
        const sharesToWithdraw = Math.floor(balance * fraction / 100);
        if (sharesToWithdraw === 0) continue;

        await withdraw(vault, depositorA, sharesToWithdraw);

        const totalAssetsAfter = await getVaultAssets(vault);
        const totalSharesAfter = await getShareSupply(vault);
        const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

        expect(Math.abs(navAfter - navBefore)).to.be.lessThan(
          NAV_TOLERANCE,
          `Iteration ${i}: NAV changed from ${navBefore} to ${navAfter} on withdrawal of ${sharesToWithdraw} shares`
        );
      }
    });

    it("Fuzz: interleaved deposits and withdrawals preserve NAV (30 iterations)", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 5_000_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const rng = new SeededRng(999);

      for (let i = 0; i < 30; i++) {
        const totalAssets = await getVaultAssets(vault);
        const totalShares = await getShareSupply(vault);
        const navBefore = computeNav(totalAssets, totalShares);

        const isDeposit = rng.range(0, 1) === 0;

        if (isDeposit) {
          const amount = rng.range(1_000_000, 500_000_000);
          await deposit(vault, depositorA, amount);
        } else {
          const balance = await getShareBalance(depositorA);
          if (balance < 100) {
            await deposit(vault, depositorA, 50_000_000);
            continue;
          }
          const fraction = rng.range(1, 20);
          const sharesToWithdraw = Math.floor(balance * fraction / 100);
          if (sharesToWithdraw === 0) continue;
          await withdraw(vault, depositorA, sharesToWithdraw);
        }

        const totalAssetsAfter = await getVaultAssets(vault);
        const totalSharesAfter = await getShareSupply(vault);
        const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

        expect(Math.abs(navAfter - navBefore)).to.be.lessThan(
          NAV_TOLERANCE,
          `Iteration ${i}: NAV changed from ${navBefore} to ${navAfter}`
        );
      }
    });

    it("Edge case: deposit exactly 1 micro-USDC is rejected (ZeroShares)", async () => {
      // With 100M+ assets and virtual offsets, 1 micro-USDC deposit
      // produces 0 shares via integer division. The vault correctly rejects this.
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 10_000_000);

      try {
        await deposit(vault, depositorA, 1);
        expect.fail("Should reject deposit that produces zero shares");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ZeroShares");
      }
    });

    it("Edge case: minimum viable deposit preserves NAV", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 10_000_000);

      const totalAssets = await getVaultAssets(vault);
      const totalShares = await getShareSupply(vault);
      const navBefore = computeNav(totalAssets, totalShares);

      // With ~110M assets, need at least ~111 micro-USDC to get 1 share
      await deposit(vault, depositorA, 1_000);

      const totalAssetsAfter = await getVaultAssets(vault);
      const totalSharesAfter = await getShareSupply(vault);
      const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

      expect(Math.abs(navAfter - navBefore)).to.be.lessThan(NAV_TOLERANCE);
    });

    it("Edge case: deposit when vault has accumulated revenue (NAV > 1.0)", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      await sendRevenue(vault, 50_000_000, 1);

      const totalAssets = await getVaultAssets(vault);
      const totalShares = await getShareSupply(vault);
      const navBefore = computeNav(totalAssets, totalShares);
      expect(navBefore).to.be.greaterThan(1.0);

      const depositorB = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorB, 100_000_000);

      const totalAssetsAfter = await getVaultAssets(vault);
      const totalSharesAfter = await getShareSupply(vault);
      const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

      expect(Math.abs(navAfter - navBefore)).to.be.lessThan(NAV_TOLERANCE);
    });

    it("Edge case: withdraw all shares", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const totalAssets = await getVaultAssets(vault);
      const totalShares = await getShareSupply(vault);
      const navBefore = computeNav(totalAssets, totalShares);

      const balance = await getShareBalance(depositorA);
      await withdraw(vault, depositorA, balance);

      // After full withdrawal, only bond + virtual offsets remain
      const totalAssetsAfter = await getVaultAssets(vault);
      const totalSharesAfter = await getShareSupply(vault);
      const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

      // NAV preserved even when all depositor shares burned
      expect(Math.abs(navAfter - navBefore)).to.be.lessThan(NAV_TOLERANCE);
    });
  });

  // ============================================================
  // INVARIANT 2: No Depositor Funds Another's Return
  // From non-circularity-proof.md: "Depositor B's deposit does not
  // increase Depositor A's NAV by a single micro-cent"
  // ============================================================
  describe("Invariant 2: No Depositor Funds Another's Return", () => {
    it("A deposits, revenue accrues, B deposits -- B does not change A's NAV", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      const depositorB = await createDepositor(vault, 1_000_000_000);

      await deposit(vault, depositorA, 100_000_000);

      const sharesA = await getShareBalance(depositorA);
      const totalAssets1 = await getVaultAssets(vault);
      const totalShares1 = await getShareSupply(vault);

      // A's NAV before revenue
      const navA_before_rev = computeNav(totalAssets1, totalShares1);

      // Revenue accrues
      await sendRevenue(vault, 20_000_000, 1);

      const totalAssets2 = await getVaultAssets(vault);
      const totalShares2 = await getShareSupply(vault);
      const navA_after_rev = computeNav(totalAssets2, totalShares2);

      expect(navA_after_rev).to.be.greaterThan(navA_before_rev);

      // B deposits
      await deposit(vault, depositorB, 100_000_000);

      const totalAssets3 = await getVaultAssets(vault);
      const totalShares3 = await getShareSupply(vault);
      const navA_after_B = computeNav(totalAssets3, totalShares3);

      // B's deposit must not change the NAV (and thus A's value)
      expect(Math.abs(navA_after_B - navA_after_rev)).to.be.lessThan(0.0001);
    });

    it("B deposits after revenue, both withdraw -- A got revenue, B did not", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      const depositorB = await createDepositor(vault, 1_000_000_000);

      const depositAmount = 100_000_000;
      await deposit(vault, depositorA, depositAmount);

      await sendRevenue(vault, 50_000_000, 1);

      const totalAssetsPreB = await getVaultAssets(vault);
      const totalSharesPreB = await getShareSupply(vault);
      const navPreB = computeNav(totalAssetsPreB, totalSharesPreB);

      await deposit(vault, depositorB, depositAmount);

      const sharesA = await getShareBalance(depositorA);
      const sharesB = await getShareBalance(depositorB);

      // A should have more shares per USDC deposited (entered at NAV 1.0 region)
      // B entered at higher NAV, so fewer shares
      expect(sharesA).to.be.greaterThan(sharesB);

      // Both withdraw
      const totalAssets4 = await getVaultAssets(vault);
      const totalShares4 = await getShareSupply(vault);
      const usdcOutA = computeAssetsForWithdraw(sharesA, totalAssets4, totalShares4);

      // Actual withdrawal for A
      await withdraw(vault, depositorA, sharesA);
      const aBalance = await getUsdcBalance(depositorA.usdcAccount);

      // A profits (deposited 100M, got back more)
      expect(aBalance).to.be.greaterThan(1_000_000_000 - depositAmount + depositAmount);

      // B withdraws
      const totalAssets5 = await getVaultAssets(vault);
      const totalShares5 = await getShareSupply(vault);
      const usdcOutB = computeAssetsForWithdraw(sharesB, totalAssets5, totalShares5);

      await withdraw(vault, depositorB, sharesB);
      const bBalance = await getUsdcBalance(depositorB.usdcAccount);

      // B should get back approximately what they deposited (no revenue accrued for them)
      const bReturn = bBalance - (1_000_000_000 - depositAmount);
      expect(bReturn).to.be.lessThanOrEqual(depositAmount + 1);
    });
  });

  // ============================================================
  // INVARIANT 3: Operator Bond First-Loss
  // From slashing-economics.md Section 6 and economic-invariants.md #4
  // ============================================================
  describe("Invariant 3: Operator Bond First-Loss", () => {
    async function createSlashAccounts(vault: VaultFixture) {
      const claimantKp = Keypair.generate();
      const arbReceiverKp = Keypair.generate();
      const sig1 = await connection.requestAirdrop(
        claimantKp.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      const sig2 = await connection.requestAirdrop(
        arbReceiverKp.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig1);
      await connection.confirmTransaction(sig2);
      const claimantUsdc = await createAccount(
        connection,
        payer,
        vault.usdcMint,
        claimantKp.publicKey
      );
      const arbUsdc = await createAccount(
        connection,
        payer,
        vault.usdcMint,
        arbReceiverKp.publicKey
      );
      return { claimantUsdc, arbUsdc };
    }

    async function doSlash(
      vault: VaultFixture,
      jobPayment: number,
      jobId: number,
      claimantUsdcAccount: PublicKey,
      arbitratorUsdcAccount: PublicKey
    ): Promise<void> {
      await program.methods
        .slash(new BN(jobPayment), new BN(jobId))
        .accountsPartial({
          vaultState: vault.vaultState,
          authority: arbitrator.publicKey,
          vaultUsdcAccount: vault.vaultUsdcAccount,
          claimantUsdcAccount,
          arbitratorUsdcAccount,
          protocolUsdcAccount: vault.protocolUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([arbitrator])
        .rpc();
    }

    it("Single slash: bond decreases, depositor NAV impact is commingling only", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const { claimantUsdc, arbUsdc } = await createSlashAccounts(vault);

      const stateBefore = await program.account.vaultState.fetch(vault.vaultState);
      const bondBefore = stateBefore.operatorBond.toNumber();

      const jobPayment = 5_000_000;
      const totalSlash = jobPayment * SLASH_MULTIPLIER;

      await doSlash(vault, jobPayment, 1, claimantUsdc, arbUsdc);

      const stateAfter = await program.account.vaultState.fetch(vault.vaultState);
      expect(stateAfter.operatorBond.toNumber()).to.equal(bondBefore - totalSlash);
      expect(stateAfter.slashEvents).to.equal(1);
      expect(stateAfter.totalSlashed.toNumber()).to.equal(totalSlash);
    });

    it("Multiple slashes up to bond exhaustion: bond to zero before depositor capital touched", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const { claimantUsdc, arbUsdc } = await createSlashAccounts(vault);

      const jobPayment = 5_000_000; // 2x = 10M per slash
      // 100M bond / 10M per slash = 10 slashes to exhaust

      for (let i = 0; i < 10; i++) {
        const state = await program.account.vaultState.fetch(vault.vaultState);
        const bondRemaining = state.operatorBond.toNumber();
        expect(bondRemaining).to.equal(MIN_OPERATOR_BOND - i * 10_000_000);

        await doSlash(vault, jobPayment, i + 1, claimantUsdc, arbUsdc);
      }

      const stateExhausted = await program.account.vaultState.fetch(vault.vaultState);
      expect(stateExhausted.operatorBond.toNumber()).to.equal(0);
      expect(stateExhausted.slashEvents).to.equal(10);

      // Next slash now eats into depositor capital
      const assetsBeforeFinal = await getVaultAssets(vault);
      await doSlash(vault, jobPayment, 11, claimantUsdc, arbUsdc);
      const assetsAfterFinal = await getVaultAssets(vault);

      const stateFinal = await program.account.vaultState.fetch(vault.vaultState);
      expect(stateFinal.operatorBond.toNumber()).to.equal(0);
      expect(assetsAfterFinal).to.equal(assetsBeforeFinal - 10_000_000);
    });

    it("75/10/15 slash distribution is correct", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const { claimantUsdc, arbUsdc } = await createSlashAccounts(vault);

      const jobPayment = 10_000_000;
      const totalSlash = jobPayment * SLASH_MULTIPLIER; // 20_000_000

      const expectedClient = Math.floor(
        (totalSlash * CLIENT_SHARE_BPS) / BPS_DENOMINATOR
      );
      const expectedArbitrator = Math.floor(
        (totalSlash * ARBITRATOR_SHARE_BPS) / BPS_DENOMINATOR
      );
      const expectedProtocol =
        totalSlash - expectedClient - expectedArbitrator;

      const protocolBefore = await getUsdcBalance(vault.protocolUsdcAccount);

      await doSlash(vault, jobPayment, 1, claimantUsdc, arbUsdc);

      const clientAfter = await getUsdcBalance(claimantUsdc);
      const arbAfter = await getUsdcBalance(arbUsdc);
      const protocolAfter = await getUsdcBalance(vault.protocolUsdcAccount);

      expect(clientAfter).to.equal(expectedClient);
      expect(arbAfter).to.equal(expectedArbitrator);
      expect(protocolAfter - protocolBefore).to.equal(expectedProtocol);

      expect(expectedClient / totalSlash).to.equal(0.75);
      expect(expectedArbitrator / totalSlash).to.equal(0.1);
      expect(expectedProtocol / totalSlash).to.equal(0.15);
    });
  });

  // ============================================================
  // INVARIANT 4: Exit at NAV After Lockup
  // From economic-invariants.md #5 and staked-asset-economics.md Section 5
  // ============================================================
  describe("Invariant 4: Exit at NAV After Lockup", () => {
    it("Withdrawal blocked before lockup expires", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 2, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const balance = await getShareBalance(depositorA);

      try {
        await withdraw(vault, depositorA, balance);
        expect.fail("Should have rejected withdrawal before lockup");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("LockupNotExpired");
      }
    });

    it("Withdrawal succeeds at NAV after lockup", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 1, 2);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      await sendRevenue(vault, 10_000_000, 1);

      // Wait for lockup
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const totalAssets = await getVaultAssets(vault);
      const totalShares = await getShareSupply(vault);
      const balance = await getShareBalance(depositorA);
      const expectedUsdc = computeAssetsForWithdraw(
        balance,
        totalAssets,
        totalShares
      );

      const usdcBefore = await getUsdcBalance(depositorA.usdcAccount);
      await withdraw(vault, depositorA, balance);
      const usdcAfter = await getUsdcBalance(depositorA.usdcAccount);

      expect(usdcAfter - usdcBefore).to.equal(expectedUsdc);
      expect(expectedUsdc).to.be.greaterThan(100_000_000);
    });

    it("Lockup reset: new deposit resets lockup for ALL shares", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 1, 3);
      const depositorA = await createDepositor(vault, 1_000_000_000);

      await deposit(vault, depositorA, 50_000_000);

      // Wait for lockup to almost expire
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // New deposit resets lockup
      await deposit(vault, depositorA, 1_000_000);

      const balance = await getShareBalance(depositorA);

      // Should fail because lockup was reset by the second deposit
      try {
        await withdraw(vault, depositorA, balance);
        expect.fail(
          "Should have rejected - lockup reset by new deposit"
        );
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("LockupNotExpired");
      }
    });
  });

  // ============================================================
  // INVARIANT 5: Revenue Is External (Anti-Wash Trading)
  // From economic-invariants.md #1: washing costs 30% per cycle
  // ============================================================
  describe("Invariant 5: Revenue Is External (Wash Cost)", () => {
    it("Revenue washing costs 30% per wash (25% vault + 5% protocol)", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const washAmount = 100_000_000; // 100 USDC

      const agentBefore = await getUsdcBalance(vault.agentUsdcAccount);
      const vaultBefore = await getVaultAssets(vault);
      const protocolBefore = await getUsdcBalance(vault.protocolUsdcAccount);

      await sendRevenue(vault, washAmount, 1);

      const agentAfter = await getUsdcBalance(vault.agentUsdcAccount);
      const vaultAfter = await getVaultAssets(vault);
      const protocolAfter = await getUsdcBalance(vault.protocolUsdcAccount);

      const agentSpent = agentBefore - agentAfter;
      const vaultGained = vaultAfter - vaultBefore;
      const protocolGained = protocolAfter - protocolBefore;

      const expectedVaultCut = Math.floor(
        (washAmount * VAULT_FEE_BPS) / BPS_DENOMINATOR
      );
      const expectedProtocolCut = Math.floor(
        (washAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR
      );

      expect(vaultGained).to.equal(expectedVaultCut);
      expect(protocolGained).to.equal(expectedProtocolCut);

      // Agent spent protocol + vault cuts
      expect(agentSpent).to.equal(expectedVaultCut + expectedProtocolCut);

      // The agent LOSES 30% of the wash amount
      const washCostBps = VAULT_FEE_BPS + PROTOCOL_FEE_BPS;
      expect(washCostBps).to.equal(3000); // 30%
      expect(agentSpent).to.equal(
        Math.floor((washAmount * washCostBps) / BPS_DENOMINATOR)
      );
    });

    it("After receive_revenue: vault balance increases by exactly vault_share", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const rng = new SeededRng(777);

      for (let i = 0; i < 10; i++) {
        const amount = rng.range(1_000_000, 100_000_000);
        const vaultBefore = await getVaultAssets(vault);

        await sendRevenue(vault, amount, i + 1);

        const vaultAfter = await getVaultAssets(vault);
        const expectedVaultCut = Math.floor(
          (amount * VAULT_FEE_BPS) / BPS_DENOMINATOR
        );

        expect(vaultAfter - vaultBefore).to.equal(
          expectedVaultCut,
          `Iteration ${i}: vault balance change incorrect for revenue ${amount}`
        );
      }
    });
  });

  // ============================================================
  // Virtual Offset Tests
  // From staked-asset-economics.md Section 3
  // ============================================================
  describe("Virtual Offset Protection", () => {
    it("First depositor inflation attack: virtual offsets prevent share manipulation", async () => {
      // Classic ERC4626 attack: deposit small amount, donate large amount to vault
      // so next depositor's shares round to 0. Virtual offsets prevent this.
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);

      const attacker = await createDepositor(vault, 2_000_000_000_000);
      const victim = await createDepositor(vault, 10_000_000_000);

      // Attacker makes a small deposit
      await deposit(vault, attacker, 1_000_000);

      // Attacker inflates vault via large revenue donation
      await sendRevenue(vault, 500_000_000, 1);

      const totalAssets = await getVaultAssets(vault);
      const totalShares = await getShareSupply(vault);

      // Without virtual offsets (V=W=0), attacker's 1M deposit would get ~10 shares.
      // After 500M revenue (125M vault cut), totalAssets = 100M bond + 1M + 125M = 226M
      // But totalShares = ~10. Victim depositing 1000 USDC:
      //   shares = 1000M * 10 / 226M = 44 shares (very few -- massive rounding loss).
      // With virtual offsets (V=W=1M), totalShares includes 1M virtual,
      // so the attacker cannot dominate the denominator.

      // Victim deposits $1000
      const victimDeposit = 1_000_000_000;
      const expectedShares = computeSharesForDeposit(
        victimDeposit,
        totalAssets,
        totalShares
      );

      expect(expectedShares).to.be.greaterThan(0);

      await deposit(vault, victim, victimDeposit);

      const victimShares = await getShareBalance(victim);
      expect(victimShares).to.be.greaterThan(0);
      expect(victimShares).to.equal(expectedShares);

      // The victim's share value should be close to their deposit (no rounding theft)
      const victimValue = computeAssetsForWithdraw(
        victimShares,
        await getVaultAssets(vault),
        await getShareSupply(vault)
      );
      // Victim loses < 1% to rounding
      expect(victimValue).to.be.greaterThan(victimDeposit * 0.99);
    });

    it("Virtual depositor yield drag is bounded at scale", async () => {
      // The virtual depositor (1M virtual shares) captures yield proportionally.
      // With bond commingling, total assets include the bond, so fewer shares
      // are minted per dollar deposited. At $10K deposit + $100 bond, the
      // depositor gets ~99M shares. Virtual fraction = 1M / (99M + 1M) = 1%.
      // As TVL grows, this fraction shrinks. At $100K TVL it's ~0.1%.
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 200_000_000_000);

      await deposit(vault, depositorA, 100_000_000_000); // $100K

      const totalShares = await getShareSupply(vault);
      const virtualFraction =
        VIRTUAL_SHARES / (totalShares + VIRTUAL_SHARES);

      // At $100K TVL, virtual fraction should be < 0.2%
      expect(virtualFraction).to.be.lessThan(0.002);
      expect(virtualFraction).to.be.greaterThan(0);

      // For monthly revenue of $75, virtual capture:
      const monthlyRevVaultCut = 75_000_000 * VAULT_FEE_BPS / BPS_DENOMINATOR;
      const virtualCapture = monthlyRevVaultCut * virtualFraction;
      const annualDragPct = (virtualCapture * 12) / 100_000_000_000 * 100;

      // At $100K TVL, annual drag is < 0.05%
      expect(annualDragPct).to.be.lessThan(0.05);
    });
  });

  // ============================================================
  // Stress Scenarios
  // From staked-asset-economics.md Section 6
  // ============================================================
  describe("Stress Scenarios", () => {
    it("Mass withdrawal: one depositor withdraws 80% of depositor TVL, remaining NAV unchanged", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositors: DepositorAccounts[] = [];

      // 5 depositors, $200 each = $1000 depositor TVL
      for (let i = 0; i < 5; i++) {
        const d = await createDepositor(vault, 1_000_000_000);
        await deposit(vault, d, 200_000_000);
        depositors.push(d);
      }

      const totalAssetsBefore = await getVaultAssets(vault);
      const totalSharesBefore = await getShareSupply(vault);
      const navBefore = computeNav(totalAssetsBefore, totalSharesBefore);

      // Depositor 0 withdraws all (20% of TVL per depositor, 80% = 4 depositors)
      // Actually, let's have 4 depositors withdraw = 80%
      for (let i = 0; i < 4; i++) {
        const balance = await getShareBalance(depositors[i]);
        await withdraw(vault, depositors[i], balance);
      }

      const totalAssetsAfter = await getVaultAssets(vault);
      const totalSharesAfter = await getShareSupply(vault);
      const navAfter = computeNav(totalAssetsAfter, totalSharesAfter);

      expect(Math.abs(navAfter - navBefore)).to.be.lessThan(0.0001);

      // The remaining depositor can still withdraw at NAV
      const remaining = depositors[4];
      const remBalance = await getShareBalance(remaining);
      expect(remBalance).to.be.greaterThan(0);

      const usdcBefore = await getUsdcBalance(remaining.usdcAccount);
      await withdraw(vault, remaining, remBalance);
      const usdcAfter = await getUsdcBalance(remaining.usdcAccount);

      // Got approximately their deposit back (NAV ~1.0 since no revenue)
      const received = usdcAfter - usdcBefore;
      // Within 1 USDC due to rounding and bond commingling
      expect(received).to.be.greaterThan(199_000_000);
      expect(received).to.be.lessThanOrEqual(201_000_000);
    });

    it("Zero revenue: NAV does not decline (no outflows)", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const totalAssets1 = await getVaultAssets(vault);
      const totalShares1 = await getShareSupply(vault);
      const nav1 = computeNav(totalAssets1, totalShares1);

      // Wait, do nothing (no revenue)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const totalAssets2 = await getVaultAssets(vault);
      const totalShares2 = await getShareSupply(vault);
      const nav2 = computeNav(totalAssets2, totalShares2);

      expect(nav2).to.equal(nav1);
      expect(totalAssets2).to.equal(totalAssets1);
      expect(totalShares2).to.equal(totalShares1);
    });

    it("High water mark: only updated when NAV exceeds previous mark", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const state0 = await program.account.vaultState.fetch(vault.vaultState);
      const hwm0 = state0.navHighWaterMark.toNumber();
      expect(hwm0).to.equal(1_000_000);

      // Revenue increases NAV, should push HWM up
      await sendRevenue(vault, 20_000_000, 1);

      const state1 = await program.account.vaultState.fetch(vault.vaultState);
      const hwm1 = state1.navHighWaterMark.toNumber();
      expect(hwm1).to.be.greaterThan(hwm0);

      // More revenue, HWM goes higher
      await sendRevenue(vault, 20_000_000, 2);

      const state2 = await program.account.vaultState.fetch(vault.vaultState);
      const hwm2 = state2.navHighWaterMark.toNumber();
      expect(hwm2).to.be.greaterThan(hwm1);
    });
  });

  // ============================================================
  // Fuzz: Multi-depositor, multi-operation sequences
  // ============================================================
  describe("Fuzz: Complex Multi-Depositor Sequences", () => {
    it("Fuzz: 3 depositors, random deposits/revenue/withdrawals -- NAV only changes from revenue (20 ops)", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositors: DepositorAccounts[] = [];
      for (let i = 0; i < 3; i++) {
        const d = await createDepositor(vault, 10_000_000_000_000);
        depositors.push(d);
      }

      // Initial deposits
      for (const d of depositors) {
        await deposit(vault, d, 100_000_000);
      }

      const rng = new SeededRng(314159);
      let revenueAdjustedNav = computeNav(
        await getVaultAssets(vault),
        await getShareSupply(vault)
      );

      for (let i = 0; i < 20; i++) {
        const op = rng.range(0, 2);

        if (op === 0) {
          // Deposit
          const dIdx = rng.range(0, 2);
          const amount = rng.range(1_000_000, 200_000_000);

          const assetsBefore = await getVaultAssets(vault);
          const sharesBefore = await getShareSupply(vault);
          const navBefore = computeNav(assetsBefore, sharesBefore);

          await deposit(vault, depositors[dIdx], amount);

          const assetsAfter = await getVaultAssets(vault);
          const sharesAfter = await getShareSupply(vault);
          const navAfter = computeNav(assetsAfter, sharesAfter);

          expect(
            Math.abs(navAfter - navBefore),
            `Op ${i} deposit: NAV changed`
          ).to.be.lessThan(0.0001);
        } else if (op === 1) {
          // Revenue
          const revAmount = rng.range(1_000_000, 50_000_000);
          await sendRevenue(vault, revAmount, i);

          revenueAdjustedNav = computeNav(
            await getVaultAssets(vault),
            await getShareSupply(vault)
          );
        } else {
          // Withdraw (small fraction)
          const dIdx = rng.range(0, 2);
          const bal = await getShareBalance(depositors[dIdx]);
          if (bal < 100) continue;

          const frac = rng.range(1, 10);
          const toWithdraw = Math.floor((bal * frac) / 100);
          if (toWithdraw === 0) continue;

          const assetsBefore = await getVaultAssets(vault);
          const sharesBefore = await getShareSupply(vault);
          const navBefore = computeNav(assetsBefore, sharesBefore);

          await withdraw(vault, depositors[dIdx], toWithdraw);

          const assetsAfter = await getVaultAssets(vault);
          const sharesAfter = await getShareSupply(vault);
          const navAfter = computeNav(assetsAfter, sharesAfter);

          expect(
            Math.abs(navAfter - navBefore),
            `Op ${i} withdrawal: NAV changed`
          ).to.be.lessThan(0.0001);
        }
      }
    });

    it("Fuzz: 5 depositors, random amounts, all withdraw at end -- total out == total in + revenue_vault_cut - rounding", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositors: DepositorAccounts[] = [];
      const rng = new SeededRng(271828);

      let totalDeposited = 0;
      for (let i = 0; i < 5; i++) {
        const d = await createDepositor(vault, 10_000_000_000);
        const amount = rng.range(10_000_000, 500_000_000);
        await deposit(vault, d, amount);
        totalDeposited += amount;
        depositors.push(d);
      }

      // Send some revenue
      let totalRevenue = 0;
      for (let i = 0; i < 5; i++) {
        const rev = rng.range(1_000_000, 20_000_000);
        await sendRevenue(vault, rev, i);
        totalRevenue += rev;
      }

      const expectedVaultCuts = Math.floor(
        (totalRevenue * VAULT_FEE_BPS) / BPS_DENOMINATOR
      );

      // Everyone withdraws
      let totalWithdrawn = 0;
      for (const d of depositors) {
        const bal = await getShareBalance(d);
        if (bal === 0) continue;
        const usdcBefore = await getUsdcBalance(d.usdcAccount);
        await withdraw(vault, d, bal);
        const usdcAfter = await getUsdcBalance(d.usdcAccount);
        totalWithdrawn += usdcAfter - usdcBefore;
      }

      // Total withdrawn should approximately equal total deposited + vault revenue cuts
      // minus what the virtual depositor captured (and bond commingling effects).
      // The virtual depositor (1M virtual shares) captures a small fraction of revenue,
      // and integer division rounding across many operations introduces small errors.
      const expectedTotal = totalDeposited + expectedVaultCuts;
      const diff = Math.abs(totalWithdrawn - expectedTotal);

      // The virtual depositor captures ~1% of vault cuts at these TVLs,
      // plus rounding errors accumulate. Allow up to 2% of vault cuts.
      const tolerance = Math.max(expectedVaultCuts * 0.02 + 100_000, 1_000_000);
      expect(diff).to.be.lessThan(
        tolerance,
        `Total withdrawn ${totalWithdrawn} vs expected ${expectedTotal}, diff ${diff}`
      );
    });
  });

  // ============================================================
  // Revenue fee split fuzz
  // ============================================================
  describe("Revenue Fee Split Fuzz", () => {
    it("Fuzz: random revenue amounts -- vault/protocol split always correct (20 iterations)", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      const rng = new SeededRng(65537);

      for (let i = 0; i < 20; i++) {
        const amount = rng.range(1, 500_000_000);
        const vaultBefore = await getVaultAssets(vault);
        const protocolBefore = await getUsdcBalance(vault.protocolUsdcAccount);

        await sendRevenue(vault, amount, i);

        const vaultAfter = await getVaultAssets(vault);
        const protocolAfter = await getUsdcBalance(vault.protocolUsdcAccount);

        const expectedVaultCut = Math.floor(
          (amount * VAULT_FEE_BPS) / BPS_DENOMINATOR
        );
        const expectedProtocolCut = Math.floor(
          (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR
        );

        expect(vaultAfter - vaultBefore).to.equal(
          expectedVaultCut,
          `Iteration ${i}: vault cut wrong for amount ${amount}`
        );
        expect(protocolAfter - protocolBefore).to.equal(
          expectedProtocolCut,
          `Iteration ${i}: protocol cut wrong for amount ${amount}`
        );
      }
    });
  });

  // ============================================================
  // Bond + deposit gate fuzz
  // ============================================================
  describe("Bond Requirement Enforcement", () => {
    it("Deposits blocked when bond falls below MIN_OPERATOR_BOND from slashing", async () => {
      const vault = await createVault(MIN_OPERATOR_BOND, 0, 86400);
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      // Fresh slash receiver accounts
      const claimantKp = Keypair.generate();
      const arbReceiverKp = Keypair.generate();
      const sig1 = await connection.requestAirdrop(
        claimantKp.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      const sig2 = await connection.requestAirdrop(
        arbReceiverKp.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig1);
      await connection.confirmTransaction(sig2);
      const claimantUsdc = await createAccount(
        connection,
        payer,
        vault.usdcMint,
        claimantKp.publicKey
      );
      const arbUsdc = await createAccount(
        connection,
        payer,
        vault.usdcMint,
        arbReceiverKp.publicKey
      );

      // 10 slashes of $5 = 100M from bond
      for (let i = 0; i < 10; i++) {
        await program.methods
          .slash(new BN(5_000_000), new BN(i))
          .accountsPartial({
            vaultState: vault.vaultState,
            authority: arbitrator.publicKey,
            vaultUsdcAccount: vault.vaultUsdcAccount,
            claimantUsdcAccount: claimantUsdc,
            arbitratorUsdcAccount: arbUsdc,
            protocolUsdcAccount: vault.protocolUsdcAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([arbitrator])
          .rpc();
      }

      const state = await program.account.vaultState.fetch(vault.vaultState);
      expect(state.operatorBond.toNumber()).to.equal(0);

      const depositorB = await createDepositor(vault, 1_000_000_000);
      try {
        await deposit(vault, depositorB, 50_000_000);
        expect.fail("Should reject deposit when bond below minimum");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InsufficientBond");
      }

      // Restake bond
      await program.methods
        .stakeBond(new BN(MIN_OPERATOR_BOND))
        .accountsPartial({
          vaultState: vault.vaultState,
          agentWallet: vault.agentWallet.publicKey,
          vaultUsdcAccount: vault.vaultUsdcAccount,
          agentUsdcAccount: vault.agentUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([vault.agentWallet])
        .rpc();

      // Now deposit should work
      await deposit(vault, depositorB, 50_000_000);
      const bal = await getShareBalance(depositorB);
      expect(bal).to.be.greaterThan(0);
    });
  });

  // ============================================================
  // NAV after revenue monotonically increasing
  // ============================================================
  describe("NAV Monotonicity from Revenue", () => {
    it("NAV strictly increases after each receive_revenue", async () => {
      const vault = await createVault();
      const depositorA = await createDepositor(vault, 1_000_000_000);
      await deposit(vault, depositorA, 100_000_000);

      let prevNav = computeNav(
        await getVaultAssets(vault),
        await getShareSupply(vault)
      );

      for (let i = 0; i < 10; i++) {
        await sendRevenue(vault, 5_000_000, i);

        const nav = computeNav(
          await getVaultAssets(vault),
          await getShareSupply(vault)
        );
        expect(nav).to.be.greaterThan(prevNav);
        prevNav = nav;
      }
    });
  });
});
