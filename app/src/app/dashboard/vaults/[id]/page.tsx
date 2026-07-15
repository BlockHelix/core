import DeploymentStatusView from '@/components/vaults/DeploymentStatusView';

export const metadata = { title: 'Vault Deployment | BlockHelix' };

export default async function VaultStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-3xl">
      <h2 className="text-xs uppercase tracking-wider-2 font-medium text-emerald-600">Deployment</h2>
      <div className="mt-6">
        <DeploymentStatusView id={id} />
      </div>
    </div>
  );
}
