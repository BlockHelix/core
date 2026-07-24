import Link from 'next/link';
import DeploymentStatusView from '@/components/vaults/DeploymentStatusView';

export const metadata = { title: 'Vault Deployment | BlockHelix' };

export default async function VaultStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shortId = id.length > 18 ? `${id.slice(0, 14)}…` : id;
  return (
    <div className="max-w-3xl">
      <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <Link
          href="/dashboard/vaults"
          className="inline-flex items-center gap-1 transition-colors hover:text-zinc-900"
        >
          <span aria-hidden>←</span> Vaults
        </Link>
        <span aria-hidden className="text-zinc-300">
          /
        </span>
        <span className="font-data text-zinc-400">{shortId}</span>
      </nav>
      <h2 className="mt-4 text-xs uppercase tracking-wider-2 font-medium text-[#10c689]">
        Deployment
      </h2>
      <div className="mt-6">
        <DeploymentStatusView id={id} />
      </div>
    </div>
  );
}
