import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';

const BASE = 'https://blockhelix.tech';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const posts: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date) : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...posts,
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/whitepaper`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/waitlist`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
