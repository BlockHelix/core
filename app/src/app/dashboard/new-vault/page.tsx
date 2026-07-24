import Link from 'next/link';
import NewVaultForm from '@/components/vaults/NewVaultForm';

export const metadata = { title: 'New Vault | BlockHelix' };

export default function NewVaultPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/vaults"
        className="text-xs uppercase tracking-wider-2 font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        ← Vaults
      </Link>
      <p className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">Deploy a USDC vault on Base</p>
      <p className="mt-2 text-sm text-zinc-600 max-w-xl leading-relaxed">
        The admin must be a deployed Gnosis Safe — it becomes the owner of the vault&apos;s role
        system. Deployment runs through the BlockHelix factory and takes a few minutes.
      </p>

      <div className="mt-6 max-w-xl rounded-xl border border-black/[0.06] bg-white p-4 shadow-soft">
        <p className="text-[11px] uppercase tracking-wider-2 font-medium text-zinc-500">
          Vault type: Veda
        </p>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          Vaults deploy Veda&apos;s BoringVault — an institutional, audited, battle-tested vault
          architecture. BlockHelix deploys a pinned version, unmodified:{' '}
          <a
            href="https://github.com/Veda-Labs/boring-vault/tree/bdc38405a02366cb5b25b358aa8e4a0b5ee3ae77"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#10c689] hover:text-[#10c689] font-data text-xs underline underline-offset-2"
          >
            Veda-Labs/boring-vault@bdc38405 ↗
          </a>
        </p>
      </div>

      <div className="mt-8">
        <NewVaultForm />
      </div>
    </div>
  );
}
