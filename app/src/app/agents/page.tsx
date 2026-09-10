import type { Metadata } from 'next';
import AgentsRecord from '@/components/pages/AgentsRecord';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'The record | BlockHelix',
  description:
    'Every vault we run, live from mainnet: NAV, carry, per-book risk and the full P&L decomposition. Own capital, deposits closed.',
};

export default function AgentsPage() {
  return <AgentsRecord />;
}
