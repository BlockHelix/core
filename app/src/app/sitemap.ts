import type { MetadataRoute } from 'next';

const BASE = 'https://blockhelix.tech';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/whitepaper`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/waitlist`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
