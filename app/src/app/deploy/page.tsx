'use client';

import dynamic from 'next/dynamic';

const DeployContent = dynamic(() => import('@/components/pages/DeployContent'), { ssr: false });

export default function Deploy() {
  return <DeployContent />;
}
