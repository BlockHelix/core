import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { AgentFactory } from '../target/types/agent_factory';
import agentFactoryIdl from '../target/idl/agent_factory.json';

const PROTOCOL_TREASURY = new PublicKey('HeLixZqQKZyBFXXEYEPWdPYg7YQkRZBVRU7mwXvxoS1');
const MIN_PROTOCOL_FEE_BPS = 50;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const factoryProgram = new Program(
    agentFactoryIdl as any,
    provider
  ) as Program<AgentFactory>;

  const [factoryState] = PublicKey.findProgramAddressSync(
    [Buffer.from('factory')],
    factoryProgram.programId
  );

  try {
    const existingFactory = await factoryProgram.account.factoryState.fetch(factoryState);
    console.log('Factory already initialized:');
    console.log('  Factory State:', factoryState.toString());
    console.log('  Authority:', existingFactory.authority.toString());
    console.log('  Protocol Treasury:', existingFactory.protocolTreasury.toString());
    console.log('  Min Protocol Fee:', existingFactory.minProtocolFeeBps, 'bps');
    console.log('  Agent Count:', existingFactory.agentCount.toString());
    return;
  } catch (err) {
    console.log('Factory not initialized. Initializing...');
  }

  const tx = await factoryProgram.methods
    .initializeFactory(MIN_PROTOCOL_FEE_BPS)
    .accountsPartial({
      factoryState,
      authority: provider.wallet.publicKey,
      protocolTreasury: PROTOCOL_TREASURY,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log('Factory initialized!');
  console.log('  Transaction:', tx);
  console.log('  Factory State:', factoryState.toString());
  console.log('  Authority:', provider.wallet.publicKey.toString());
  console.log('  Protocol Treasury:', PROTOCOL_TREASURY.toString());
  console.log('  Min Protocol Fee:', MIN_PROTOCOL_FEE_BPS, 'bps');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
