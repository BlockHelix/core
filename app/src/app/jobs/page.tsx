'use client';

import dynamic from 'next/dynamic';

const PostJobContent = dynamic(() => import('@/components/pages/PostJobContent'), { ssr: false });

export default function JobsPage() {
  return <PostJobContent />;
}
