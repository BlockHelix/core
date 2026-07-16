import AdminUsersTable from '@/components/admin/AdminUsersTable';

export const metadata = { title: 'Users | BlockHelix Admin' };

export default function AdminUsersPage() {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider-2 font-medium text-emerald-600">Users</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Tiers, vault usage and per-user entitlement overrides.
      </p>
      <div className="mt-6">
        <AdminUsersTable />
      </div>
    </div>
  );
}
