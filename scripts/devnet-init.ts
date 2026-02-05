import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AgentVault } from "../target/types/agent_vault";
import { ReceiptRegistry } from "../target/types/receipt_registry";
import { AgentFactory } from "../target/types/agent_factory";
import agentVaultIdl from "../target/idl/agent_vault.json";
import receiptRegistryIdl from "../target/idl/receipt_registry.json";
import agentFactoryIdl from "../target/idl/agent_factory.json";
import * as fs from "fs";
import * as path from "path";

const VAULT_PROGRAM_ID = new PublicKey(
  "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS"
);
const REGISTRY_PROGRAM_ID = new PublicKey(
  "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9"
);
const FACTORY_PROGRAM_ID = new PublicKey(
  "7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j"
);

const MIN_PROTOCOL_FEE_BPS = 50;
const AGENT_FEE_BPS = 7000;
const PROTOCOL_FEE_BPS = 500;
const CHALLENGE_WINDOW = new anchor.BN(86400);
const MAX_TVL = new anchor.BN(10_000_000_000);
const LOCKUP_EPOCHS = 0;
const EPOCH_LENGTH = new anchor.BN(86400);
const TARGET_APY_BPS = 2000;
const LENDING_FLOOR_BPS = 500;
const OPERATOR_BOND_AMOUNT = new anchor.BN(100_000_000);
const USDC_MINT_AMOUNT = 10_000_000_000;

function loadKeypair(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;
  const deployer = wallet.payer;

  console.log("=== BlockHelix Devnet Initialization ===");
  console.log("Deployer:", deployer.publicKey.toString());
  console.log(
    "Balance:",
    (await connection.getBalance(deployer.publicKey)) / LAMPORTS_PER_SOL,
    "SOL"
  );

  const vaultProgram = new Program(
    agentVaultIdl as any,
    provider
  ) as Program<AgentVault>;
  const registryProgram = new Program(
    receiptRegistryIdl as any,
    provider
  ) as Program<ReceiptRegistry>;
  const factoryProgram = new Program(
    agentFactoryIdl as any,
    provider
  ) as Program<AgentFactory>;

  // Step 1: Create devnet USDC mint
  console.log("\n--- Step 1: Create Devnet USDC Mint ---");

  const usdcMintKeypairPath = path.join(
    __dirname,
    "..",
    "target",
    "deploy",
    "devnet-usdc-mint.json"
  );

  let usdcMint: PublicKey;

  if (fs.existsSync(usdcMintKeypairPath)) {
    const savedMint = loadKeypair(usdcMintKeypairPath);
    usdcMint = savedMint.publicKey;
    console.log("USDC mint already exists:", usdcMint.toString());

    try {
      await connection.getAccountInfo(usdcMint);
      console.log("Confirmed on-chain");
    } catch {
      console.log("Mint keypair exists but not on-chain, recreating...");
      usdcMint = await createMint(
        connection,
        deployer,
        deployer.publicKey,
        deployer.publicKey,
        6,
        savedMint
      );
      console.log("USDC mint created:", usdcMint.toString());
    }
  } else {
    const mintKeypair = Keypair.generate();
    fs.writeFileSync(
      usdcMintKeypairPath,
      JSON.stringify(Array.from(mintKeypair.secretKey))
    );

    usdcMint = await createMint(
      connection,
      deployer,
      deployer.publicKey,
      deployer.publicKey,
      6,
      mintKeypair
    );
    console.log("USDC mint created:", usdcMint.toString());
  }

  // Mint USDC to deployer
  const deployerUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    usdcMint,
    deployer.publicKey
  );
  console.log(
    "Deployer USDC account:",
    deployerUsdcAccount.address.toString()
  );

  if (Number(deployerUsdcAccount.amount) < USDC_MINT_AMOUNT) {
    await mintTo(
      connection,
      deployer,
      usdcMint,
      deployerUsdcAccount.address,
      deployer,
      USDC_MINT_AMOUNT
    );
    console.log("Minted", USDC_MINT_AMOUNT / 1_000_000, "USDC to deployer");
  } else {
    console.log(
      "Deployer already has",
      Number(deployerUsdcAccount.amount) / 1_000_000,
      "USDC"
    );
  }

  // Step 2: Create protocol treasury USDC account
  console.log("\n--- Step 2: Setup Protocol Treasury ---");

  const protocolTreasury = deployer.publicKey;
  const protocolUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    usdcMint,
    protocolTreasury
  );
  console.log("Protocol treasury:", protocolTreasury.toString());
  console.log(
    "Protocol treasury USDC ATA:",
    protocolUsdcAccount.address.toString()
  );

  // Step 3: Initialize factory
  console.log("\n--- Step 3: Initialize Factory ---");

  const [factoryState] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    FACTORY_PROGRAM_ID
  );

  try {
    const existingFactory =
      await factoryProgram.account.factoryState.fetch(factoryState);
    console.log("Factory already initialized");
    console.log("  Factory State:", factoryState.toString());
    console.log("  Authority:", existingFactory.authority.toString());
    console.log("  Agent Count:", existingFactory.agentCount.toString());
  } catch {
    const tx = await factoryProgram.methods
      .initializeFactory(MIN_PROTOCOL_FEE_BPS)
      .accountsPartial({
        factoryState,
        authority: deployer.publicKey,
        protocolTreasury: protocolTreasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Factory initialized!");
    console.log("  TX:", tx);
    console.log("  Factory State:", factoryState.toString());
  }

  // Step 4: Create DefiData Patch Agent via factory
  console.log("\n--- Step 4: Create DefiData Patch Agent ---");

  const agentWallet = deployer;
  const agentId = 0;

  const [agentMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("agent"),
      factoryState.toBuffer(),
      new anchor.BN(agentId).toArrayLike(Buffer, "le", 8),
    ],
    FACTORY_PROGRAM_ID
  );

  const [vaultState] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), agentWallet.publicKey.toBuffer()],
    VAULT_PROGRAM_ID
  );

  const [shareMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("shares"), vaultState.toBuffer()],
    VAULT_PROGRAM_ID
  );

  const vaultUsdcAccount = PublicKey.findProgramAddressSync(
    [
      vaultState.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      usdcMint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];

  const [registryState] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), vaultState.toBuffer()],
    REGISTRY_PROGRAM_ID
  );

  try {
    const existingAgent =
      await factoryProgram.account.agentMetadata.fetch(agentMetadata);
    console.log("Agent already created");
    console.log("  Agent ID:", existingAgent.agentId.toString());
    console.log("  Name:", existingAgent.name);
    console.log("  Vault:", existingAgent.vault.toString());
    console.log("  Registry:", existingAgent.registry.toString());
  } catch {
    const tx = await factoryProgram.methods
      .createAgent(
        "DefiData Patch Agent",
        "blockhelix",
        "https://defidata-agent.blockhelix.io",
        AGENT_FEE_BPS,
        PROTOCOL_FEE_BPS,
        CHALLENGE_WINDOW,
        MAX_TVL,
        LOCKUP_EPOCHS,
        EPOCH_LENGTH,
        TARGET_APY_BPS,
        LENDING_FLOOR_BPS,
        deployer.publicKey
      )
      .accountsPartial({
        factoryState,
        agentMetadata,
        agentWallet: agentWallet.publicKey,
        vaultState,
        shareMint,
        usdcMint,
        vaultUsdcAccount,
        protocolTreasury: protocolTreasury,
        registryState,
        vaultProgram: VAULT_PROGRAM_ID,
        registryProgram: REGISTRY_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("DefiData Patch Agent created!");
    console.log("  TX:", tx);
  }

  // Step 5: Stake operator bond
  console.log("\n--- Step 5: Stake Operator Bond ---");

  const vaultData = await vaultProgram.account.vaultState.fetch(vaultState);

  if (vaultData.operatorBond.gte(OPERATOR_BOND_AMOUNT)) {
    console.log(
      "Bond already staked:",
      vaultData.operatorBond.toNumber() / 1_000_000,
      "USDC"
    );
  } else {
    const agentUsdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployer,
      usdcMint,
      agentWallet.publicKey
    );

    const tx = await vaultProgram.methods
      .stakeBond(OPERATOR_BOND_AMOUNT)
      .accountsPartial({
        vaultState,
        agentWallet: agentWallet.publicKey,
        vaultUsdcAccount,
        agentUsdcAccount: agentUsdcAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Operator bond staked!");
    console.log("  TX:", tx);
    console.log("  Amount:", OPERATOR_BOND_AMOUNT.toNumber() / 1_000_000, "USDC");
  }

  // Final summary
  console.log("\n\n========================================");
  console.log("=== DEVNET DEPLOYMENT SUMMARY ===");
  console.log("========================================\n");

  console.log("PROGRAMS:");
  console.log("  agent_vault:", VAULT_PROGRAM_ID.toString());
  console.log("  receipt_registry:", REGISTRY_PROGRAM_ID.toString());
  console.log("  agent_factory:", FACTORY_PROGRAM_ID.toString());

  console.log("\nACCOUNTS:");
  console.log("  USDC Mint:", usdcMint.toString());
  console.log("  Factory State:", factoryState.toString());
  console.log("  Protocol Treasury:", protocolTreasury.toString());
  console.log(
    "  Protocol Treasury USDC ATA:",
    protocolUsdcAccount.address.toString()
  );

  console.log("\nDEFIDATA PATCH AGENT (ID: 0):");
  console.log("  Agent Wallet:", agentWallet.publicKey.toString());
  console.log("  Agent Metadata:", agentMetadata.toString());
  console.log("  Vault State:", vaultState.toString());
  console.log("  Share Mint:", shareMint.toString());
  console.log("  Vault USDC Account:", vaultUsdcAccount.toString());
  console.log("  Registry State:", registryState.toString());

  const finalVault = await vaultProgram.account.vaultState.fetch(vaultState);
  console.log("\nVAULT STATS:");
  console.log(
    "  Operator Bond:",
    finalVault.operatorBond.toNumber() / 1_000_000,
    "USDC"
  );
  console.log("  Agent Fee:", finalVault.agentFeeBps, "bps");
  console.log("  Protocol Fee:", finalVault.protocolFeeBps, "bps");
  console.log("  Max TVL:", finalVault.maxTvl.toNumber() / 1_000_000, "USDC");
  console.log("  Paused:", finalVault.paused);

  const finalFactory =
    await factoryProgram.account.factoryState.fetch(factoryState);
  console.log("\nFACTORY STATS:");
  console.log("  Agent Count:", finalFactory.agentCount.toString());

  console.log(
    "\nRemaining SOL balance:",
    (await connection.getBalance(deployer.publicKey)) / LAMPORTS_PER_SOL
  );

  // Save deployment info
  const deploymentInfo = {
    network: "devnet",
    timestamp: new Date().toISOString(),
    programs: {
      agentVault: VAULT_PROGRAM_ID.toString(),
      receiptRegistry: REGISTRY_PROGRAM_ID.toString(),
      agentFactory: FACTORY_PROGRAM_ID.toString(),
    },
    accounts: {
      usdcMint: usdcMint.toString(),
      factoryState: factoryState.toString(),
      protocolTreasury: protocolTreasury.toString(),
      protocolTreasuryUsdcAta: protocolUsdcAccount.address.toString(),
    },
    defiDataAgent: {
      agentId: 0,
      agentWallet: agentWallet.publicKey.toString(),
      agentMetadata: agentMetadata.toString(),
      vaultState: vaultState.toString(),
      shareMint: shareMint.toString(),
      vaultUsdcAccount: vaultUsdcAccount.toString(),
      registryState: registryState.toString(),
    },
  };

  const deploymentPath = path.join(__dirname, "..", "devnet-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
