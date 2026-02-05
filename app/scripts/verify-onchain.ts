import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PROGRAM_IDS, RPC_URL } from '../src/lib/anchor';
import { findFactoryState } from '../src/lib/pda';
import AgentVaultIDL from '../src/lib/idl/agent_vault.json';
import AgentFactoryIDL from '../src/lib/idl/agent_factory.json';
import ReceiptRegistryIDL from '../src/lib/idl/receipt_registry.json';

async function verifyOnChainDeployment() {
  console.log('\n=== BlockHelix On-Chain Verification ===\n');

  console.log('RPC URL:', RPC_URL);
  console.log('Network: devnet\n');

  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Program IDs:');
  console.log('- Vault Program:', PROGRAM_IDS.VAULT.toString());
  console.log('- Factory Program:', PROGRAM_IDS.FACTORY.toString());
  console.log('- Registry Program:', PROGRAM_IDS.REGISTRY.toString());
  console.log('');

  console.log('Step 1: Verify RPC Connection...');
  try {
    const version = await connection.getVersion();
    console.log('✓ RPC connected successfully');
    console.log('  Solana version:', version['solana-core']);
  } catch (error) {
    console.error('✗ RPC connection failed:', error);
    process.exit(1);
  }

  console.log('\nStep 2: Verify Program Deployments...');

  const programs = [
    { name: 'Vault Program', id: PROGRAM_IDS.VAULT },
    { name: 'Factory Program', id: PROGRAM_IDS.FACTORY },
    { name: 'Registry Program', id: PROGRAM_IDS.REGISTRY },
  ];

  for (const prog of programs) {
    try {
      const accountInfo = await connection.getAccountInfo(prog.id);
      if (accountInfo && accountInfo.executable) {
        console.log(`✓ ${prog.name} deployed`);
        console.log(`  Executable: true, Owner: ${accountInfo.owner.toString()}`);
      } else {
        console.log(`✗ ${prog.name} NOT FOUND or not executable`);
      }
    } catch (error) {
      console.log(`✗ ${prog.name} check failed:`, error);
    }
  }

  console.log('\nStep 3: Check Factory State...');
  try {
    const dummyProvider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );

    const factoryProgram = new Program(AgentFactoryIDL as any, dummyProvider);
    const [factoryState] = findFactoryState();

    console.log('  Factory State PDA:', factoryState.toString());

    const factoryData = await factoryProgram.account.factoryState.fetch(factoryState);
    console.log('✓ Factory initialized');
    console.log('  Agent count:', (factoryData as any).agentCount.toString());
    console.log('  Authority:', (factoryData as any).authority.toString());
  } catch (error: any) {
    if (error.message.includes('Account does not exist')) {
      console.log('✗ Factory not initialized yet');
      console.log('  Run the initialization script to create factory state');
    } else {
      console.log('✗ Factory check failed:', error.message);
    }
  }

  console.log('\nStep 4: Check for Deployed Agents...');
  try {
    const dummyProvider = new AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );

    const factoryProgram = new Program(AgentFactoryIDL as any, dummyProvider);
    const agentAccounts = await factoryProgram.account.agentMetadata.all();

    if (agentAccounts.length === 0) {
      console.log('✗ No agents deployed yet');
      console.log('  Deploy the first agent via the UI or CLI');
    } else {
      console.log(`✓ Found ${agentAccounts.length} agent(s) deployed`);
      agentAccounts.forEach((agent, i) => {
        const acc = agent.account as any;
        console.log(`\n  Agent ${i + 1}:`);
        console.log(`    Name: ${acc.name}`);
        console.log(`    GitHub: @${acc.githubHandle}`);
        console.log(`    Wallet: ${acc.agentWallet.toString()}`);
        console.log(`    Vault: ${acc.vault.toString()}`);
        console.log(`    Active: ${acc.isActive}`);
      });
    }
  } catch (error: any) {
    console.log('✗ Agent check failed:', error.message);
  }

  console.log('\n=== Verification Complete ===\n');
}

verifyOnChainDeployment().catch(console.error);
