import * as anchor from '@coral-xyz/anchor';
import * as fs from 'fs';

const VAULT_KEY = '6qdu18b5DSN1yMgQXiuG2JzXsgxtmUgreUADRC1zpRTx';

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const idl = JSON.parse(fs.readFileSync('target/idl/receipt_registry.json', 'utf-8'));
  const program = new anchor.Program(idl, provider);
  
  const [registryState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), new anchor.web3.PublicKey(VAULT_KEY).toBuffer()],
    program.programId
  );
  
  console.log('Registry PDA:', registryState.toBase58());
  const registry = await program.account.registryState.fetch(registryState);
  console.log('Operator:', (registry as any).operator.toBase58());
  console.log('JobSigner:', (registry as any).jobSigner.toBase58());
}
main().catch(console.error);
