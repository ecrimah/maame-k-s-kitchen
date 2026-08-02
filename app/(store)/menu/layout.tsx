import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maamekskitchen.ca';

export const metadata: Metadata = {
  title: 'Full Menu',
  description: 'Browse our full menu of authentic Ghanaian dishes — banku, jollof rice, waakye, fufu, soups, grills, drinks and more. Order online for same-day delivery in Calgary.',
  keywords: [
    'Ghanaian menu Calgary', 'banku Calgary', 'jollof rice Calgary', 'waakye Calgary',
    'fufu Calgary', 'Ghanaian food online order', 'African food delivery Calgary',
    'omotuo', 'okro soup', 'groundnut soup', 'Ghanaian catering Calgary',
  ],
  alternates: { canonical: `${siteUrl}/menu` },
  openGraph: {
    title: "Our Menu | Maame K\u2019s Kitchen",
    description: 'Authentic Ghanaian dishes made fresh daily — order online for same-day delivery or pickup in Calgary.',
    url: `${siteUrl}/menu`,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "Maame K\u2019s Kitchen Full Menu" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Our Menu | Maame K\u2019s Kitchen",
    description: 'Authentic Ghanaian dishes made fresh daily. Order online for same-day delivery in Calgary.',
  },
};

type CategoryGroup = { name: string; slug: string; items: { name: string; description: string | null; price: number | null; slug: string; image: string | null }[] };

async function getMenuData(): Promise<CategoryGroup[]> {
  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('name, description, price, slug, category_id, product_images(url), categories(name, slug)')
      .eq('status', 'active')
      .limit(120);
    if (!products) return [];
    const map = new Map<string, CategoryGroup>();
    for (const p of products as any[]) {
      const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories;
      const catName = cat?.name || 'Menu';
      const catSlug = cat?.slug || 'menu';
      if (!map.has(catSlug)) map.set(catSlug, { name: catName, slug: catSlug, items: [] });
      map.get(catSlug)!.items.push({
        name: p.name,
        description: p.description ? String(p.description).replace(/<[^>]*>/g, '').slice(0, 240) : null,
        price: p.price ?? null,
        slug: p.slug,
        image: p.product_images?.[0]?.url || null,
      });
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  const groups = await getMenuData();

  const menuSchema = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${siteUrl}/menu#menu`,
    name: 'Maame K\u2019s Kitchen Menu',
    inLanguage: 'en-CA',
    hasMenuSection: groups.map((g) => ({
      '@type': 'MenuSection',
      name: g.name,
      hasMenuItem: g.items.map((i) => ({
        '@type': 'MenuItem',
        name: i.name,
        description: i.description || undefined,
        image: i.image || undefined,
        url: `${siteUrl}/product/${i.slug}`,
        offers:
          i.price != null
            ? { '@type': 'Offer', price: i.price, priceCurrency: 'CAD' }
            : undefined,
      })),
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Menu', item: `${siteUrl}/menu` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}