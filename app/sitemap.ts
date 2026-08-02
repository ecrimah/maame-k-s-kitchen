import { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/menu`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/meal-prep`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faqs`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/shipping`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/returns`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Static blog posts
  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog/1`,
      lastModified: new Date('2024-12-15'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/2`,
      lastModified: new Date('2024-12-12'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog/3`,
      lastModified: new Date('2024-12-10'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  let productPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];

  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('slug, updated_at')
      .eq('status', 'active');

    if (products) {
      productPages = products.map((product) => ({
        url: `${baseUrl}/product/${product.slug}`,
        lastModified: new Date(product.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }

    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('slug, updated_at')
      .eq('status', 'active');

    if (categories) {
      categoryPages = categories.map((category) => ({
        url: `${baseUrl}/menu?category=${category.slug}`,
        lastModified: new Date(category.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return [...staticPages, ...blogPages, ...productPages, ...categoryPages];
}
