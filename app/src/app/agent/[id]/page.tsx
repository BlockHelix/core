import AgentDetailContent from '@/components/pages/AgentDetailContent';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

async function getAgentData(id: string) {
  try {
    const res = await fetch(`${RUNTIME_URL}/v1/agent/${id}`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialData = await getAgentData(id);
  return <AgentDetailContent initialData={initialData} />;
}
