import fs from 'fs';
import path from 'path';
import WhitepaperContent from '@/components/pages/WhitepaperContent';

export default function WhitepaperPage() {
  const filePath = path.join(process.cwd(), '..', 'docs', 'whitepaper.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  return <WhitepaperContent content={content} />;
}
