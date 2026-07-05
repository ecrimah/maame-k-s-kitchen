'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getAvailabilityMode,
  getPreorderLeadHours,
  isSaturdayOnly,
  isProductAvailableToday,
  getProductVideos,
  formatPreorderNotice,
  offersProteinChoice,
} from '@/lib/product-availability';
import { embedVideoUrl, isEmbeddableStream } from '@/lib/video-embed';



export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [proteins, setProteins] = useState<any[]>([]);
  const [selectedProtein, setSelectedProtein] = useState<any>(null);
  const [orderNotes, setOrderNotes] = useState('');


  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch main product (cached for 2 minutes)
        const { data: productData, error } = await cachedQuery<{ data: any; error: any }>(
          `product:${slug}`,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name),
                product_variants(*),
                product_images(url, position, alt_text)
              `);

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

            if (isUUID) {
              query = query.or(`id.eq.${slug},slug.eq.${slug}`);
            } else {
              query = query.eq('slug', slug);
            }

            return query.single() as any;
          },
          2 * 60 * 1000 // 2 minutes
        );

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        // Transform product data
        const rawVariants = (productData.product_variants || []).map((v: any) => ({ ...v }));

        const transformedProduct = {
          ...productData,
          images: productData.product_images?.sort((a: any, b: any) => a.position - b.position).map((img: any) => img.url) || [],
          category: productData.categories?.name || 'Menu',
          rating: productData.rating_avg || 0,
          reviewCount: 0,
          stockCount: 99,
          moq: productData.moq || 1,
  
  
          variants: rawVariants,
          sizes: rawVariants.map((v: any) => v.name) || [],
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: productData.metadata?.preorder_shipping || null
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['/logo.png'];
        }

        setProduct(transformedProduct);

        // Set initial quantity to MOQ
        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // If variants exist, do NOT pre-select — force user to choose
        // Reset variant and color selection
        setSelectedVariant(null);
        setSelectedVariant(null);

        // Fetch related products (cached for 5 minutes)
        if (productData.category_id) {
          const { data: related } = await cachedQuery<{ data: any; error: any }>(
            `related:${productData.category_id}:${productData.id}`,
            (() => supabase
              .from('products')
              .select('*, product_images(url, position), product_variants(id, name, price, quantity)')
              .eq('category_id', productData.category_id)
              .neq('id', productData.id)
              .limit(4)) as any,
            5 * 60 * 1000
          );

          if (related) {
            setRelatedProducts(related.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || '/logo.png',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: p.status === 'active',
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  useEffect(() => {
    if (!product || !offersProteinChoice(product)) {
      setProteins([]);
      setSelectedProtein(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await cachedQuery<{ data: any; error: any }>(
        'proteins:active',
        (() => supabase
          .from('proteins')
          .select('id, name, description, price_delta, image_url')
          .eq('is_active', true)
          .order('position', { ascending: true })
          .order('name', { ascending: true })) as any,
        2 * 60 * 1000
      );
      if (!cancelled && data) setProteins(data);
    })();
    return () => { cancelled = true; };
  }, [product]);

  const hasVariants = product?.variants?.length > 0;
  const offersProtein = product ? offersProteinChoice(product) && proteins.length > 0 : false;
  const needsProteinSelection = offersProtein && !selectedProtein;

  const needsVariantSelection = hasVariants && !selectedVariant;
  const needsSelection = needsVariantSelection || needsProteinSelection;


  // Determine the active price: variant price if selected, otherwise base price,
  // plus any extra charge for the chosen protein.
  const basePrice = selectedVariant?.price ?? product?.price ?? 0;
  const proteinDelta = selectedProtein ? Number(selectedProtein.price_delta) || 0 : 0;
  const activePrice = basePrice + proteinDelta;
  const isAvailable = product?.inStock !== false;

  const handleAddToCart = () => {
    if (!product) return;
    if (needsSelection) return; // Safety check

    const variantLabel = [selectedVariant?.name, selectedProtein?.name]
      .filter(Boolean)
      .join(' · ') || undefined;

    addToCart({
      id: product.id,
      name: product.name,
      price: activePrice,
      image: product.images[0],
      quantity: quantity,
      variant: variantLabel,
      slug: product.slug,
      moq: product.moq || 1,
      preorder: getAvailabilityMode(product) === 'preorder',
      preorderLeadHours: getPreorderLeadHours(product),
      saturdayOnly: isSaturdayOnly(product),
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12 flex justify-center items-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-[#C8952A] animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading dish...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Dish Not Found</h2>
          <Link href="/menu" className="text-[#C8952A] hover:underline">View Menu</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price ? Math.round((1 - activePrice / product.compare_at_price) * 100) : 0;
  const minVariantPrice = hasVariants ? Math.min(...product.variants.map((v: any) => v.price || product.price)) : product.price;

  const isPreorder = getAvailabilityMode(product) === 'preorder';
  const preorderLeadHours = getPreorderLeadHours(product);
  const saturdayOnly = isSaturdayOnly(product);
  const availableToday = isProductAvailableToday(product);
  const productVideos = getProductVideos(product);

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: hasVariants ? minVariantPrice : product.price,
    currency: 'CAD',
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.inStock ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'Menu', url: `${baseUrl}/menu` },
    { name: product.category, url: `${baseUrl}/menu?category=${product.category.toLowerCase().replace(/\s+/g, '-')}` },
    { name: product.name, url: `${baseUrl}/product/${slug}` }
  ]);

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="min-h-screen bg-white">
        <section className="py-8 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-2 text-sm flex-wrap gap-y-2">
              <Link href="/" className="text-gray-600 hover:text-[#C8952A] transition-colors">Home</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="/menu" className="text-gray-600 hover:text-[#C8952A] transition-colors">Menu</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="#" className="text-gray-600 hover:text-[#C8952A] transition-colors">{product.category}</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 shadow-lg border border-gray-100">
                  <Image
                    src={product.images[selectedImage]}
                    alt={product.name}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                    quality={80}
                  />
                  {discount > 0 && (
                    <span className="absolute top-6 right-6 bg-[#111111] text-white text-sm font-semibold px-4 py-2 rounded-full">
                      Save {discount}%
                    </span>
                  )}
                </div>

                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {product.images.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage === index ? 'border-[#C8952A] shadow-md' : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <Image
                          src={image}
                          alt={`${product.name} view ${index + 1}`}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 1024px) 25vw, 12vw"
                          quality={60}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {productVideos.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Watch</h3>
                    {productVideos.map((url, index) => {
                      const embed = embedVideoUrl(url);
                      if (!embed) return null;
                      return (
                        <div key={index} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                          {isEmbeddableStream(url) ? (
                            <iframe
                              src={embed}
                              title={`${product.name} video ${index + 1}`}
                              className="w-full h-full"
                              allowFullScreen
                            />
                          ) : (
                            <video src={embed} controls className="w-full h-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col xl:pl-8">
                <div className="flex flex-col mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[11px] tracking-[0.2em] text-gray-500 uppercase font-bold">{product.category}</p>
                    <button
                      onClick={() => setIsWishlisted(!isWishlisted)}
                      className="group w-10 h-10 flex items-center justify-center bg-white border border-black/[0.04] hover:border-black/[0.08] rounded-full transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
                    >
                      <i className={`${isWishlisted ? 'ri-heart-fill text-[#C8952A] scale-110' : 'ri-heart-line text-gray-400 group-hover:text-gray-600'} text-lg transition-all`}></i>
                    </button>
                  </div>
                  <h1 className="text-3xl md:text-4xl lg:text-[44px] font-serif font-medium text-gray-900 leading-[1.1] tracking-tight">{product.name}</h1>
                  {(isPreorder || saturdayOnly) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {isPreorder && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#fdf9ec] text-[#a07020] text-xs font-bold uppercase tracking-wider border border-[#e8c87a]">
                          Pre-order · {formatPreorderNotice(preorderLeadHours)}
                        </span>
                      )}
                      {saturdayOnly && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider border border-gray-200">
                          Saturday menu
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center mb-7">
                  <div className="flex items-center space-x-0.5 mr-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`${star <= Math.round(product.rating) ? 'ri-star-fill text-gray-900' : 'ri-star-line text-gray-200'} text-[17px]`}
                      ></i>
                    ))}
                  </div>
                  <span className="text-gray-500 text-sm font-medium">{Number(product.rating).toFixed(1)}</span>
                </div>

                <div className="flex items-baseline space-x-3 mb-8">
                  {hasVariants && !selectedVariant ? (
                    <span className="text-2xl lg:text-[30px] font-medium text-gray-900">
                      <span className="text-lg text-gray-400 font-light mr-1.5">From</span>${minVariantPrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-2xl lg:text-[30px] font-medium text-gray-900">${activePrice.toFixed(2)}</span>
                  )}
                  {product.compare_at_price && product.compare_at_price > activePrice && (
                    <span className="text-lg text-gray-400 line-through decoration-gray-300">${product.compare_at_price.toFixed(2)}</span>
                  )}
                </div>

                <p className="text-gray-500 leading-[1.8] mb-6 text-[15.5px] font-light max-w-[95%]">{product.description}</p>

                {(isPreorder || (saturdayOnly && !availableToday)) && (
                  <div className="mb-8 p-4 rounded-xl bg-[#fdf9ec] border border-[#e8c87a] text-[#6b5018] text-sm leading-relaxed">
                    {isPreorder && (
                      <p className="font-medium">
                        <i className="ri-time-line mr-1.5 align-middle"></i>
                        This dish requires advance notice ({formatPreorderNotice(preorderLeadHours)}). We will confirm your ready date after you place your order.
                      </p>
                    )}
                    {saturdayOnly && !availableToday && (
                      <p className={isPreorder ? 'mt-2' : ''}>
                        <i className="ri-calendar-line mr-1.5 align-middle"></i>
                        Available on Saturdays only. You can still order now — we will schedule it for the next available Saturday.
                      </p>
                    )}
                  </div>
                )}

                {/* Size / Name Variant Selector */}
                {hasVariants && (() => {
                  const hasColors = false;
                  const visibleVariants = product.variants;
                  const showNameSelector = visibleVariants.length > 0;
                  if (false) {
                    // Single variant with no colors — show standard picker
                    return (
                      <div className="mb-8">
                        <label className="block text-sm font-medium text-gray-900 mb-3 tracking-wide">
                          Portion: {selectedVariant ? (
                            <span className="text-gray-500 font-normal ml-1">{selectedVariant.name}</span>
                          ) : (
                            <span className="text-[#C8952A] font-normal text-xs ml-1">Please select a portion</span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                          {product.variants.map((variant: any) => {
                            const isSelected = selectedVariant?.id === variant.id || selectedVariant?.name === variant.name;
                            const variantStock = variant.stock ?? variant.quantity ?? 0;
                            const isUnavailable = !isAvailable;
                            return (
                              <button
                                key={variant.id || variant.name}
                                onClick={() => {
                                  setSelectedVariant(variant);
                
                                }}
                                disabled={isUnavailable}
                                className={`px-5 py-2.5 rounded-xl border font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center min-w-[5rem] ${isSelected
                                  ? 'border-gray-900 ring-1 ring-gray-900/10 bg-white text-gray-900 shadow-sm'
                                  : isUnavailable
                                    ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50/50'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50/50'
                                  }`}
                              >
                                <span className="text-[14px]">{variant.name}</span>
                                <span className={`text-[11px] mt-0.5 ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}>
                                  ${(variant.price || product.price).toFixed(2)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (visibleVariants.length > 1) {
                    return (
                      <div className="mb-8">
                        <label className="block text-sm font-medium text-gray-900 mb-3 tracking-wide">
                          Portion: {selectedVariant ? (
                            <span className="text-gray-500 font-normal ml-1">{selectedVariant.name}</span>
                          ) : (
                            <span className="text-[#C8952A] font-normal text-xs ml-1">Please select</span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                          {visibleVariants.map((variant: any) => {
                            const isSelected = selectedVariant?.id === variant.id;
                            const variantStock = variant.stock ?? variant.quantity ?? 0;
                            const isUnavailable = !isAvailable;
                            return (
                              <button
                                key={variant.id || variant.name}
                                onClick={() => {
                                  setSelectedVariant(variant);
                
                                }}
                                disabled={isUnavailable}
                                className={`px-5 py-2.5 rounded-xl border font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center min-w-[4.5rem] ${isSelected
                                  ? 'border-gray-900 ring-1 ring-gray-900/10 bg-white text-gray-900 shadow-sm'
                                  : isUnavailable
                                    ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50/50'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50/50'
                                  }`}
                              >
                                <span className="text-[14px]">{variant.name}</span>
                                <span className={`text-[11px] mt-0.5 ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}>
                                  ${(variant.price || product.price).toFixed(2)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {offersProtein && (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-900 mb-3 tracking-wide">
                      Choose your protein: {selectedProtein ? (
                        <span className="text-gray-500 font-normal ml-1">{selectedProtein.name}</span>
                      ) : (
                        <span className="text-[#C8952A] font-normal text-xs ml-1">Please select</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {proteins.map((protein: any) => {
                        const isSelected = selectedProtein?.id === protein.id;
                        const delta = Number(protein.price_delta) || 0;
                        return (
                          <button
                            key={protein.id}
                            onClick={() => setSelectedProtein(protein)}
                            disabled={!isAvailable}
                            className={`px-5 py-2.5 rounded-xl border font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center min-w-[5rem] ${isSelected
                              ? 'border-gray-900 ring-1 ring-gray-900/10 bg-white text-gray-900 shadow-sm'
                              : !isAvailable
                                ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50/50'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50/50'
                              }`}
                          >
                            <span className="text-[14px]">{protein.name}</span>
                            <span className={`text-[11px] mt-0.5 ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}>
                              {delta > 0 ? `+$${delta.toFixed(2)}` : 'No extra'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-10">
                  <label className="block text-sm font-medium text-gray-900 mb-3 tracking-wide">Quantity</label>
                  <div className="flex items-center space-x-5">
                    <div className="flex items-center bg-gray-50/80 rounded-xl border border-black/[0.04]">
                      <button
                        onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all rounded-l-xl cursor-pointer"
                        disabled={!isAvailable || quantity <= (product.moq || 1)}
                      >
                        <i className="ri-subtract-line text-lg"></i>
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(product.moq || 1, parseInt(e.target.value) || (product.moq || 1)))}
                        className="w-14 h-12 text-center bg-transparent border-none focus:ring-0 text-[15px] font-medium text-gray-900"
                        min={product.moq || 1}
                        max={20}
                        disabled={!isAvailable}
                      />
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-12 h-12 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all rounded-r-xl cursor-pointer"
                        disabled={!isAvailable}
                      >
                        <i className="ri-add-line text-lg"></i>
                      </button>
                    </div>
                    <div className="flex flex-col">
                      {product.moq > 1 && (
                        <span className="text-gray-500 font-medium text-xs tracking-wide">
                          <i className="ri-information-line mr-1 text-gray-400"></i>
                          Min. order: {product.moq} units
                        </span>
                      )}
                      {false && (
                        <span className="text-gray-500 font-medium text-xs flex items-center tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C8952A] mr-2 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"></span>
                        </span>
                      )}
                      {isAvailable && false && (
                        <span className="text-[#C8952A] font-medium text-xs flex items-center tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C8952A] mr-2 shadow-[0_0_8px_rgba(251,191,36,0.5)] pulse-fast"></span>
                        </span>
                      )}
                      {!isAvailable && (
                        <span className="text-gray-400 font-medium text-xs flex items-center tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2"></span>
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>


                {/* Order Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Special Instructions <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <textarea
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="e.g. Extra spicy, no okro, less pepper..."
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8952A] focus:border-transparent resize-none"
                    maxLength={200}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3.5 mb-10">
                  <button
                    disabled={!isAvailable || needsSelection}
                    className={`flex-1 group relative overflow-hidden bg-[#111111] text-white py-4 px-6 rounded-xl font-medium transition-all duration-500 flex items-center justify-center space-x-2.5 text-[15px] shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 whitespace-nowrap cursor-pointer ${(!isAvailable || needsSelection) ? 'opacity-50 cursor-not-allowed hover:-translate-y-0' : ''}`}
                    onClick={handleAddToCart}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <i className="ri-shopping-cart-2-line text-lg relative z-10"></i>
                    <span className="relative z-10 tracking-wide">{!isAvailable ? 'Unavailable' : needsVariantSelection ? 'Select a Portion' : needsProteinSelection ? 'Choose a Protein' : 'Add to Order'}</span>
                  </button>
                  {isAvailable && !needsSelection  && (
                    <button
                      onClick={handleBuyNow}
                      className="sm:w-[160px] bg-white border border-black/[0.06] hover:border-black/[0.12] hover:bg-gray-50 text-gray-900 py-4 rounded-xl font-medium transition-all duration-300 whitespace-nowrap cursor-pointer shadow-sm tracking-wide"
                    >
                      Order Now
                    </button>
                  )}
                </div>

                <div className="border-t border-black/[0.04] pt-8 space-y-4">
                  <div className="flex items-center text-gray-500 text-[14px] font-light">
                    <i className="ri-store-2-line text-lg text-gray-400 mr-3.5"></i>
                    <span>Pickup available · Cornerstone, NE Calgary</span>
                  </div>
                  <div className="flex items-center text-gray-500 text-[14px] font-light">
                    <i className="ri-arrow-left-right-line text-lg text-gray-400 mr-3.5"></i>
                    <span>Issue with your order? Contact us within 2 hours</span>
                  </div>
                  <div className="flex items-center text-gray-500 text-[14px] font-light">
                    <i className="ri-shield-check-line text-lg text-gray-400 mr-3.5"></i>
                    <span>Secure payment & buyer protection</span>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="border-b border-gray-300 mb-8">
              <div className="flex space-x-4 sm:space-x-8 overflow-x-auto">
                {['description', 'ingredients', 'allergens', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 font-semibold transition-colors relative whitespace-nowrap cursor-pointer ${activeTab === tab
                      ? 'text-[#C8952A] border-b-2 border-[#C8952A]'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">What's in this dish</h3>
                <ul className="grid md:grid-cols-2 gap-4">
                  {product.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <i className="ri-checkbox-circle-fill text-[#C8952A] text-xl mr-3 mt-1"></i>
                      <span className="text-gray-700 text-lg">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'care' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Allergen Information</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{product.allergens || 'No allergen information available. Contact us if you have specific dietary requirements.'}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div id="reviews">
                <ProductReviews productId={product.id} />
              </div>
            )}
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="py-20 bg-white" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">You May Also Like</h2>
                <p className="text-lg text-gray-600">More dishes from our kitchen</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} {...p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

