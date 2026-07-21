import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug, formatDate } from '@/lib/blog';
import PostBody from '@/components/blog/PostBody';

const BASE = 'https://blockhelix.tech';

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `${BASE}/blog/${post.slug}`;
  return {
    title: `${post.title} | BlockHelix`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      url,
      siteName: 'BlockHelix',
      title: post.title,
      description: post.description,
      publishedTime: post.date || undefined,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const url = `${BASE}/blog/${post.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: post.author, url: BASE },
    publisher: { '@type': 'Organization', name: 'BlockHelix', url: BASE },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
  };

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <Link
          href="/blog"
          className="text-sm font-mono text-gray-400 hover:text-emerald-600 transition-colors"
        >
          ← Writing
        </Link>

        <p className="mt-8 text-xs font-mono text-gray-400">{formatDate(post.date)}</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-gray-900 leading-[1.1]">
          {post.title}
        </h1>
        {post.description && (
          <p className="mt-5 text-xl text-gray-500 leading-relaxed">{post.description}</p>
        )}
        <p className="mt-5 text-xs font-mono text-gray-400">{post.author}</p>

        <hr className="mt-10 border-gray-200" />

        <div className="mt-10">
          <PostBody content={post.content} />
        </div>

        <hr className="mt-16 border-gray-200" />
        <div className="mt-8">
          <Link
            href="/waitlist"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium tracking-widest bg-gray-900 text-white hover:bg-black transition-colors"
          >
            REGISTER FOR UPDATES
            <span>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
