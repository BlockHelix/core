import Link from 'next/link';
import NewVaultForm from '@/components/vaults/NewVaultForm';

export const metadata = { title: 'New Vault | BlockHelix' };

export default function NewVaultPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/vaults"
        className="text-xs uppercase tracking-wider-2 font-medium text-white/50 hover:text-white transition-colors"
      >
        ← Vaults
      </Link>
      <p className="mt-4 text-xl font-medium text-white">Deploy a USDC vault on Base</p>
      <p className="mt-2 text-sm text-white/50 max-w-xl">
        The admin must be a deployed Gnosis Safe — it becomes the owner of the vault&apos;s role
        system. Deployment runs through the BlockHelix factory and takes a few minutes.
      </p>
      <div className="mt-8">
        <NewVaultForm />
      </div>
    </div>
  );
}
