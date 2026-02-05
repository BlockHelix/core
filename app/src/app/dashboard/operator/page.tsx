'use client';

import dynamic from 'next/dynamic';

const OperatorDashboard = dynamic(() => import('@/components/pages/OperatorDashboard'), { ssr: false });

export default function OperatorDashboardPage() {
  return <OperatorDashboard />;
}
