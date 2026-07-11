import DeploymentStatusView from '@/components/vaults/DeploymentStatusView';

export const metadata = { title: 'Vault Deployment | BlockHelix' };

export default async function VaultStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-12">
      <h1 className="text-xs uppercase tracking-wider-2 font-medium text-emerald-400">Deployment</h1>
      <div className="mt-6">
        <DeploymentStatusView id={id} />
      </div>
    </main>
  );
}
