'use client';

import dynamic from 'next/dynamic';

const CreateContent = dynamic(() => import('@/components/pages/CreateContent'), { ssr: false });

export default function Create() {
  return <CreateContent />;
}
