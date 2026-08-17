import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/lock', '/admin', '/api/'],
    },
    sitemap: 'https://my-memory-for-you.vercel.app/sitemap.xml',
  };
}
