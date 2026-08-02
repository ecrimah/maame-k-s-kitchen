import { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProductDetailClient from './ProductDetailClient';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

async function getProductMeta(slug: string) {
  try {
    const { data } = await supabaseAdmin
      .from('products')
      .select('id, name, description, price, sku, status, product_images(url), categories(name)')
      .eq('slug', slug)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductMeta(slug);

  if (!product) {
    return {
      title: 'Dish Not Found',
      description: 'This dish could not be found on our menu.',
      robots: { index: false, follow: false },
    };
  }

  const title = product.name;
  const rawDescription = product.description || '';
  const description = rawDescription
    ? rawDescription.replace(/<[^>]*>/g, '').slice(0, 155)
    : `Order ${title} from Maame K\u2019s Kitchen — authentic Ghanaian cuisine in Cornerstone, NE Calgary.`;

  const images = product.product_images as { url: string }[] | null;
  const firstImage = images?.[0]?.url;
  const ogImage = firstImage || `${siteUrl}/opengraph-image`;

  return {
    title,
    description,
    keywords: [
      title,
      `${title} Calgary`,
      'Ghanaian food Calgary',
      'order online',
      'Maame K\u2019s Kitchen',
    ],
    openGraph: {
      title: `${title} | Maame K\u2019s Kitchen`,
      description,
      url: `${siteUrl}/product/${slug}`,
      type: 'website',
      siteName: 'Maame K\u2019s Kitchen',
      locale: 'en_CA',
      images: [{ url: ogImage, width: firstImage ? 800 : 1200, height: firstImage ? 800 : 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Maame K\u2019s Kitchen`,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `${siteUrl}/product/${slug}`,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductMeta(slug);

  const rawImages = (product?.product_images ?? []) as unknown as { url: string }[];
  const imageUrls = rawImages.map((i) => i.url);
  const rawCategory = product?.categories as unknown;
  const categoryName = Array.isArray(rawCategory)
    ? (rawCategory[0] as { name?: string } | undefined)?.name
    : (rawCategory as { name?: string } | null | undefined)?.name;

  const productSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: (product.description || '').replace(/<[^>]*>/g, '').slice(0, 500),
        image: imageUrls.length > 0 ? imageUrls : [`${siteUrl}/opengraph-image`],
        sku: product.sku || product.id || slug,
        brand: { '@type': 'Brand', name: 'Maame K\u2019s Kitchen' },
        category: categoryName || 'Ghanaian Cuisine',
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'CAD',
          availability:
            product.status === 'active'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          url: `${siteUrl}/product/${slug}`,
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          seller: { '@type': 'Restaurant', name: 'Maame K\u2019s Kitchen' },
        },
      }
    : null;

  const breadcrumbSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Menu', item: `${siteUrl}/menu` },
          { '@type': 'ListItem', position: 3, name: product.name, item: `${siteUrl}/product/${slug}` },
        ],
      }
    : null;

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      <ProductDetailClient slug={slug} />
    </>
  );
}
