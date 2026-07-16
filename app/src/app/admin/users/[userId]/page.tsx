import AdminUserDetail from '@/components/admin/AdminUserDetail';

export const metadata = { title: 'User | BlockHelix Admin' };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <AdminUserDetail userId={userId} />;
}
