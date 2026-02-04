'use client';

import dynamic from 'next/dynamic';

const DashboardContent = dynamic(() => import('@/components/pages/DashboardContent'), { ssr: false });

export default function Dashboard() {
  return <DashboardContent />;
}
