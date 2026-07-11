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

      <div className="mt-6 border border-white/10 bg-white/[0.02] p-4 max-w-xl">
        <p className="text-[11px] uppercase tracking-wider-2 font-medium text-white/50">
          Vault type: Veda
        </p>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          Vaults deploy Veda&apos;s BoringVault — an institutional, audited, battle-tested vault
          architecture. BlockHelix deploys a pinned version, unmodified:{' '}
          <a
            href="https://github.com/Veda-Labs/boring-vault/tree/60b5528adca0543fcc22ab2ce4e533df4e79f734"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 font-data text-xs underline underline-offset-2"
          >
            Veda-Labs/boring-vault@60b5528 ↗
          </a>
        </p>
      </div>

      <div className="mt-8">
        <NewVaultForm />
      </div>
    </div>
  );
}
