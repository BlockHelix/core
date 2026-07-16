import AdminVaultsTable from '@/components/admin/AdminVaultsTable';

export const metadata = { title: 'Vaults | BlockHelix Admin' };

export default function AdminVaultsPage() {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider-2 font-medium text-emerald-600">All vaults</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Every deployment across all users. Open a vault to run on-chain admin actions.
      </p>
      <div className="mt-6">
        <AdminVaultsTable />
      </div>
    </div>
  );
}
