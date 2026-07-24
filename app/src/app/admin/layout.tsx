import { redirect } from 'next/navigation';
import { getAdminUserId } from '@/lib/server/admin';
import { ToastProvider } from '@/components/ui/Toast';
import WalletProvider from '@/components/wallet/WalletProvider';
import ConnectButton from '@/components/wallet/ConnectButton';
import AdminNav from '@/components/admin/AdminNav';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';

export const metadata = { title: 'Admin | BlockHelix' };

// Server-side gate: only Clerk users with publicMetadata.role === 'admin' may
// render anything under /admin. Non-admins are bounced to the dashboard. The
// WalletProvider (Reown AppKit) is mounted ONLY here — never on the customer app.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect('/dashboard');
  }

  return (
    <WalletProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[#fafafa] text-zinc-950">
          <main className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[11px] font-medium uppercase tracking-wider-2 text-[#10c689]">Admin</h1>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Operations console</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AdminGlobalSearch />
                <ConnectButton />
              </div>
            </header>

            <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
              <AdminNav />
              <div className="min-w-0">{children}</div>
            </div>
          </main>
        </div>
      </ToastProvider>
    </WalletProvider>
  );
}
