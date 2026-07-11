import VaultList from '@/components/vaults/VaultList';

export const metadata = { title: 'Dashboard | BlockHelix' };

export default function DashboardPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-12">
      <h1 className="text-xs uppercase tracking-wider-2 font-medium text-emerald-400">Dashboard</h1>
      <p className="mt-2 text-2xl font-medium text-white">Your Vaults</p>
      <div className="mt-8">
        <VaultList />
      </div>
    </main>
  );
}
