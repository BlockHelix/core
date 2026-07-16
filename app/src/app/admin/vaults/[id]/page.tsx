import AdminVaultDetail from '@/components/admin/AdminVaultDetail';

export const metadata = { title: 'Vault | BlockHelix Admin' };

export default async function AdminVaultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminVaultDetail id={id} />;
}
