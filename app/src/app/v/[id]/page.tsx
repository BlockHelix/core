import VaultLifeContent from '@/components/pages/VaultLifeContent';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

async function getLife(id: string) {
  try {
    const res = await fetch(`${RUNTIME_URL}/v1/vaults/${id}/life`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function VaultLifePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialData = await getLife(id);
  return <VaultLifeContent agentId={id} initialData={initialData} />;
}
