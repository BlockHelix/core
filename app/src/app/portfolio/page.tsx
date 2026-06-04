import PortfolioContent from '@/components/pages/PortfolioContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Portfolio — BlockHelix',
  description: 'Track your vault positions, value, and withdrawal options.',
};

export default function PortfolioPage() {
  return <PortfolioContent />;
}
