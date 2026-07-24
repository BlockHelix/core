import { ToastProvider } from '@/components/ui/Toast';
import DashboardNav from '@/components/dashboard/DashboardNav';
import PlanUsageBar from '@/components/dashboard/PlanUsageBar';

export const metadata = { title: 'Dashboard | BlockHelix' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#fafafa] text-zinc-950">
        <main className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
          <header className="mb-6">
            <h1 className="text-[11px] font-medium uppercase tracking-wider-2 text-[#10c689]">Dashboard</h1>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Developer console</p>
          </header>

          <PlanUsageBar />

          <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
            <DashboardNav />
            <div className="min-w-0">{children}</div>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
