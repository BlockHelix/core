import fs from 'fs';
import path from 'path';
import WhitepaperContent from '@/components/pages/WhitepaperContent';

export const metadata = {
  title: 'Whitepaper | BlockHelix',
  description:
    'How BlockHelix enforces execution policy on onchain vaults: merkle-authorized bounds, re-verified by the vault on-chain.',
};

export default function WhitepaperPage() {
  const filePath = path.join(process.cwd(), '..', 'docs', 'whitepaper.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  return <WhitepaperContent content={content} />;
}
