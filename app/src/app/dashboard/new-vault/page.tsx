import NewVaultForm from '@/components/vaults/NewVaultForm';

export const metadata = { title: 'New Vault | BlockHelix' };

export default function NewVaultPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-12">
      <h1 className="text-xs uppercase tracking-wider-2 font-medium text-emerald-400">New Vault</h1>
      <p className="mt-2 text-2xl font-medium text-white">Deploy a USDC vault on Base</p>
      <p className="mt-3 text-sm text-white/50 max-w-xl">
        The admin must be a deployed Gnosis Safe — it becomes the owner of the vault&apos;s role
        system. Deployment runs through the BlockHelix factory and takes a few minutes.
      </p>
      <div className="mt-10">
        <NewVaultForm />
      </div>
    </main>
  );
}
