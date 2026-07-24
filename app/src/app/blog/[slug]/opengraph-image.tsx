import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/blog';

export const alt = 'BlockHelix';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title ?? 'BlockHelix';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', color: '#2beead', fontSize: 28, letterSpacing: 10 }}>
          BLOCKHELIX
        </div>
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: title.length > 48 ? 58 : 68,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.5)', fontSize: 28 }}>
          blockhelix.tech/blog
        </div>
      </div>
    ),
    { ...size },
  );
}
