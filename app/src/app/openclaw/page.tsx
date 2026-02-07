import { Suspense } from 'react';
import OpenClawContent from '@/components/pages/OpenClawContent';

export const metadata = {
  title: 'OpenClaw | One-Click Agent Deploy',
  description: 'Deploy AI agents in isolated containers with one click. No infrastructure needed.',
};

export default function OpenClawPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <OpenClawContent />
    </Suspense>
  );
}
