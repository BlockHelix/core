'use client';

import dynamic from 'next/dynamic';

const AgentDetailContent = dynamic(() => import('@/components/pages/AgentDetailContent'), { ssr: false });

export default function AgentDetail() {
  return <AgentDetailContent />;
}
