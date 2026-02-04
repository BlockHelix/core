import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AgentFactory } from "../target/types/agent_factory";
import { AgentVault } from "../target/types/agent_vault";
import { ReceiptRegistry } from "../target/types/receipt_registry";
import {
  createMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("agent-factory", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const factoryProgram = anchor.workspace
    .AgentFactory as Program<AgentFactory>;
  const vaultProgram = anchor.workspace.AgentVault as Program<AgentVault>;
  const registryProgram = anchor.workspace
    .ReceiptRegistry as Program<ReceiptRegistry>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const authority = Keypair.generate();
  const protocolTreasury = Keypair.generate();
  const agentWallet = Keypair.generate();
  const arbitratorKey = Keypair.generate();

  let usdcMint: PublicKey;
  let factoryState: PublicKey;

  const MIN_PROTOCOL_FEE_BPS = 500;
  const AGENT_FEE_BPS = 7000;
  const PROTOCOL_FEE_BPS = 500;
  const CHALLENGE_WINDOW = new BN(86400);
  const MAX_TVL = new BN(1_000_000_000_000);
  const LOCKUP_EPOCHS = 1;
  const EPOCH_LENGTH = new BN(86400);
  const TARGET_APY_BPS = 1000;
  const LENDING_FLOOR_BPS = 800;

  before(async () => {
    const sigs = await Promise.all([
      connection.requestAirdrop(
        authority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      connection.requestAirdrop(
        agentWallet.publicKey,
        5 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);
    for (const sig of sigs) {
      await connection.confirmTransaction(sig);
    }

    usdcMint = await createMint(connection, payer, payer.publicKey, null, 6);

    [factoryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      factoryProgram.programId
    );
  });

  it("initializes factory", async () => {
    await factoryProgram.methods
      .initializeFactory(MIN_PROTOCOL_FEE_BPS)
      .accountsPartial({
        factoryState,
        authority: authority.publicKey,
        protocolTreasury: protocolTreasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const state = await factoryProgram.account.factoryState.fetch(factoryState);
    expect(state.authority.toString()).to.equal(
      authority.publicKey.toString()
    );
    expect(state.protocolTreasury.toString()).to.equal(
      protocolTreasury.publicKey.toString()
    );
    expect(state.minProtocolFeeBps).to.equal(MIN_PROTOCOL_FEE_BPS);
    expect(state.agentCount.toNumber()).to.equal(0);
  });

  it("creates agent with vault and registry via CPI", async () => {
    const agentId = 0;

    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    const [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentWallet.publicKey.toBuffer()],
      vaultProgram.programId
    );

    const [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      vaultProgram.programId
    );

    const vaultUsdcAccount = getAssociatedTokenAddressSync(
      usdcMint,
      vaultState,
      true
    );

    const [registryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), vaultState.toBuffer()],
      registryProgram.programId
    );

    await factoryProgram.methods
      .createAgent(
        "DefiData Patch Agent",
        "blockhelix",
        "https://agent.blockhelix.io",
        AGENT_FEE_BPS,
        PROTOCOL_FEE_BPS,
        CHALLENGE_WINDOW,
        MAX_TVL,
        LOCKUP_EPOCHS,
        EPOCH_LENGTH,
        TARGET_APY_BPS,
        LENDING_FLOOR_BPS,
        arbitratorKey.publicKey
      )
      .accountsPartial({
        factoryState,
        agentMetadata,
        agentWallet: agentWallet.publicKey,
        vaultState,
        shareMint,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolTreasury.publicKey,
        registryState,
        vaultProgram: vaultProgram.programId,
        registryProgram: registryProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentWallet])
      .rpc();

    // Verify factory state
    const factory = await factoryProgram.account.factoryState.fetch(
      factoryState
    );
    expect(factory.agentCount.toNumber()).to.equal(1);

    // Verify agent metadata
    const metadata = await factoryProgram.account.agentMetadata.fetch(
      agentMetadata
    );
    expect(metadata.name).to.equal("DefiData Patch Agent");
    expect(metadata.githubHandle).to.equal("blockhelix");
    expect(metadata.endpointUrl).to.equal("https://agent.blockhelix.io");
    expect(metadata.agentWallet.toString()).to.equal(
      agentWallet.publicKey.toString()
    );
    expect(metadata.vault.toString()).to.equal(vaultState.toString());
    expect(metadata.registry.toString()).to.equal(registryState.toString());
    expect(metadata.shareMint.toString()).to.equal(shareMint.toString());
    expect(metadata.agentId.toNumber()).to.equal(0);
    expect(metadata.isActive).to.equal(true);

    // Verify vault was created via CPI
    const vault = await vaultProgram.account.vaultState.fetch(vaultState);
    expect(vault.agentWallet.toString()).to.equal(
      agentWallet.publicKey.toString()
    );
    expect(vault.agentFeeBps).to.equal(AGENT_FEE_BPS);
    expect(vault.protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
    expect(vault.maxTvl.toString()).to.equal(MAX_TVL.toString());

    // Verify registry was created via CPI
    const registry = await registryProgram.account.registryState.fetch(
      registryState
    );
    expect(registry.agentWallet.toString()).to.equal(
      agentWallet.publicKey.toString()
    );
    expect(registry.vault.toString()).to.equal(vaultState.toString());
    expect(registry.jobCounter.toNumber()).to.equal(0);
    expect(registry.challengeWindow.toNumber()).to.equal(
      CHALLENGE_WINDOW.toNumber()
    );
  });

  it("creates a second agent", async () => {
    const agent2 = Keypair.generate();
    const sig = await connection.requestAirdrop(
      agent2.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const agentId = 1;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    const [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agent2.publicKey.toBuffer()],
      vaultProgram.programId
    );
    const [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      vaultProgram.programId
    );
    const vaultUsdcAccount = getAssociatedTokenAddressSync(
      usdcMint,
      vaultState,
      true
    );
    const [registryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), vaultState.toBuffer()],
      registryProgram.programId
    );

    await factoryProgram.methods
      .createAgent(
        "Agent Two",
        "agent2gh",
        "https://agent2.example.com",
        6000,
        600,
        new BN(3600),
        new BN(500_000_000_000),
        0,
        new BN(86400),
        TARGET_APY_BPS,
        LENDING_FLOOR_BPS,
        arbitratorKey.publicKey
      )
      .accountsPartial({
        factoryState,
        agentMetadata,
        agentWallet: agent2.publicKey,
        vaultState,
        shareMint,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolTreasury.publicKey,
        registryState,
        vaultProgram: vaultProgram.programId,
        registryProgram: registryProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent2])
      .rpc();

    const factory = await factoryProgram.account.factoryState.fetch(
      factoryState
    );
    expect(factory.agentCount.toNumber()).to.equal(2);

    const metadata = await factoryProgram.account.agentMetadata.fetch(
      agentMetadata
    );
    expect(metadata.name).to.equal("Agent Two");
    expect(metadata.agentId.toNumber()).to.equal(1);
  });

  it("rejects protocol fee below minimum", async () => {
    const badAgent = Keypair.generate();
    const sig = await connection.requestAirdrop(
      badAgent.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const agentId = 2;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    const [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), badAgent.publicKey.toBuffer()],
      vaultProgram.programId
    );
    const [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      vaultProgram.programId
    );
    const vaultUsdcAccount = getAssociatedTokenAddressSync(
      usdcMint,
      vaultState,
      true
    );
    const [registryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), vaultState.toBuffer()],
      registryProgram.programId
    );

    try {
      await factoryProgram.methods
        .createAgent(
          "Bad Agent",
          "badguy",
          "https://bad.example.com",
          7000,
          100, // below 500 minimum
          new BN(86400),
          MAX_TVL,
          0,
          new BN(86400),
          TARGET_APY_BPS,
          LENDING_FLOOR_BPS,
          arbitratorKey.publicKey
        )
        .accountsPartial({
          factoryState,
          agentMetadata,
          agentWallet: badAgent.publicKey,
          vaultState,
          shareMint,
          usdcMint,
          vaultUsdcAccount,
          protocolTreasury: protocolTreasury.publicKey,
          registryState,
          vaultProgram: vaultProgram.programId,
          registryProgram: registryProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([badAgent])
        .rpc();
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ProtocolFeeBelowMinimum");
    }
  });

  it("rejects fees exceeding 100%", async () => {
    const badAgent = Keypair.generate();
    const sig = await connection.requestAirdrop(
      badAgent.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    const agentId = 2;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    const [vaultState] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), badAgent.publicKey.toBuffer()],
      vaultProgram.programId
    );
    const [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("shares"), vaultState.toBuffer()],
      vaultProgram.programId
    );
    const vaultUsdcAccount = getAssociatedTokenAddressSync(
      usdcMint,
      vaultState,
      true
    );
    const [registryState] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), vaultState.toBuffer()],
      registryProgram.programId
    );

    try {
      await factoryProgram.methods
        .createAgent(
          "Bad Agent",
          "badguy",
          "https://bad.example.com",
          9000,
          2000, // 9000 + 2000 = 11000 > 10000
          new BN(86400),
          MAX_TVL,
          0,
          new BN(86400),
          TARGET_APY_BPS,
          LENDING_FLOOR_BPS,
          arbitratorKey.publicKey
        )
        .accountsPartial({
          factoryState,
          agentMetadata,
          agentWallet: badAgent.publicKey,
          vaultState,
          shareMint,
          usdcMint,
          vaultUsdcAccount,
          protocolTreasury: protocolTreasury.publicKey,
          registryState,
          vaultProgram: vaultProgram.programId,
          registryProgram: registryProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([badAgent])
        .rpc();
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("TotalFeesExceed100Percent");
    }
  });

  it("updates agent metadata", async () => {
    const agentId = 0;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    await factoryProgram.methods
      .updateAgent(
        "Updated Patch Agent",
        null,
        "https://v2.agent.blockhelix.io"
      )
      .accountsPartial({
        agentMetadata,
        agentWallet: agentWallet.publicKey,
      })
      .signers([agentWallet])
      .rpc();

    const metadata = await factoryProgram.account.agentMetadata.fetch(
      agentMetadata
    );
    expect(metadata.name).to.equal("Updated Patch Agent");
    expect(metadata.githubHandle).to.equal("blockhelix");
    expect(metadata.endpointUrl).to.equal("https://v2.agent.blockhelix.io");
    expect(metadata.isActive).to.equal(true);
  });

  it("rejects update from wrong wallet", async () => {
    const agentId = 0;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    const wrongWallet = Keypair.generate();
    const sig = await connection.requestAirdrop(
      wrongWallet.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    try {
      await factoryProgram.methods
        .updateAgent("Hacked", null, null)
        .accountsPartial({
          agentMetadata,
          agentWallet: wrongWallet.publicKey,
        })
        .signers([wrongWallet])
        .rpc();
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("deactivates agent", async () => {
    const agentId = 0;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    await factoryProgram.methods
      .deactivateAgent()
      .accountsPartial({
        agentMetadata,
        agentWallet: agentWallet.publicKey,
      })
      .signers([agentWallet])
      .rpc();

    const metadata = await factoryProgram.account.agentMetadata.fetch(
      agentMetadata
    );
    expect(metadata.isActive).to.equal(false);
  });

  it("rejects update on deactivated agent", async () => {
    const agentId = 0;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    try {
      await factoryProgram.methods
        .updateAgent("Should Fail", null, null)
        .accountsPartial({
          agentMetadata,
          agentWallet: agentWallet.publicKey,
        })
        .signers([agentWallet])
        .rpc();
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AgentAlreadyInactive");
    }
  });

  it("rejects double deactivation", async () => {
    const agentId = 0;
    const [agentMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("agent"),
        factoryState.toBuffer(),
        new BN(agentId).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    try {
      await factoryProgram.methods
        .deactivateAgent()
        .accountsPartial({
          agentMetadata,
          agentWallet: agentWallet.publicKey,
        })
        .signers([agentWallet])
        .rpc();
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AgentAlreadyInactive");
    }
  });
});
