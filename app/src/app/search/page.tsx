import { Suspense } from 'react';
import SearchContent from '@/components/pages/SearchContent';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

async function getAgents() {
  try {
    const res = await fetch(`${RUNTIME_URL}/v1/agents`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.agents;
  } catch {
    return null;
  }
}

export default async function SearchPage() {
  const initialAgents = await getAgents();
  return (
    <Suspense>
      <SearchContent initialAgents={initialAgents} />
    </Suspense>
  );
}
