'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

const EditAgentContent = dynamic(() => import('@/components/pages/EditAgentContent'), { ssr: false });

export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EditAgentContent agentId={id} />;
}
