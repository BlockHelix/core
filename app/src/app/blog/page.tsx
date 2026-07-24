import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPosts, formatDate } from '@/lib/blog';

const DESCRIPTION =
  'Notes on execution risk, onchain vault guardrails, and building the risk layer for automated finance.';

export const metadata: Metadata = {
  title: 'Writing | BlockHelix',
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: 'https://blockhelix.tech/blog',
    siteName: 'BlockHelix',
    title: 'Writing | BlockHelix',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Writing | BlockHelix',
    description: DESCRIPTION,
  },
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <p className="text-xs uppercase tracking-[0.2em] font-mono text-gray-400 mb-4">{'// Writing'}</p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Writing</h1>
        <p className="text-lg text-gray-600 mt-4 max-w-2xl">
          Notes on execution risk and building guardrails for automated finance.
        </p>

        <div className="mt-12 border-t border-gray-200">
          {posts.length === 0 && (
            <p className="py-10 text-gray-400 font-mono text-sm">No posts yet.</p>
          )}
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-gray-200 py-8 group">
              <Link href={`/blog/${post.slug}`} className="block">
                <p className="text-xs font-mono text-gray-400">{formatDate(post.date)}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 group-hover:text-[#10c689] transition-colors">
                  {post.title}
                </h2>
                <p className="mt-2 text-gray-600 leading-relaxed">{post.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-mono text-[#10c689]">
                  Read
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
