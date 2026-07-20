import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/admin/', '/sign-in', '/sign-up', '/api/'],
    },
    sitemap: 'https://blockhelix.tech/sitemap.xml',
    host: 'https://blockhelix.tech',
  };
}
