import { Suspense } from 'react';
import SearchContent from '@/components/pages/SearchContent';

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent initialAgents={[]} prelaunch />
    </Suspense>
  );
}
