'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';
import NewsletterSection from '@/components/NewsletterSection';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';


function getOpenStatus() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Edmonton' }));
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= 10 && h < 21;
}

export default function Home() {
  usePageTitle('');
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Maame K’s Kitchen';
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isOpen = getOpenStatus();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrentSlide(p => (p + 1) % 3), 5000);
    return () => clearInterval(t);
  }, []);


  useEffect(() => {
    async function fetchData() {
      try {
        let { data: productsData } = await supabase
          .from('products')
          .select('*, product_variants(*), product_images(*)')
          .eq('status', 'active')
          .eq('featured', true)
          .order('created_at', { ascending: false })
          .limit(8);
        if (!productsData || productsData.length === 0) {
          const { data: fallbackProducts } = await supabase
            .from('products')
            .select('*, product_variants(*), product_images(*)')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(8);
          productsData = fallbackProducts;
        }
        setFeaturedProducts(productsData || []);

        const { data: categoriesData } = await supabase
          .from('categories')
          .select('id, name, slug, image_url, metadata')
          .eq('status', 'active')
          .order('name');
        setCategories(categoriesData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main className="flex-col items-center justify-between min-h-screen">

      {/* ═══════════════════════════════════════
      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <section className="relative w-full h-[65svh] sm:h-[100svh] min-h-[480px] sm:min-h-[600px] overflow-hidden bg-[#0a0a0a] flex flex-col">

        {/* ── Slide backgrounds ── */}
        {['/home_hero_1.webp', '/home_hero_2.webp', '/home_hero_3.webp'].map((src, idx) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image
              src={src}
              alt={`Hero slide ${idx + 1}`}
              fill
              className="object-cover object-center"
              priority={idx === 0}
              sizes="100vw"
              quality={80}
            />
          </div>
        ))}

        {/* ── Overlays — dark gradient so text pops ── */}
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 z-10" />

        {/* ── Top gold accent line ── */}
        <div className="absolute top-0 left-0 right-0 h-[2px] z-20 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #C8952A 40%, #e8b428 60%, transparent 100%)' }} />

        {/* ── Slide content — unique text per slide ── */}
        {[
          {
            eyebrow: 'Cornerstone, NE Calgary — Est. 2025',
            headline: ['Taste of ', 'Ghana,', '\nin Calgary'],
            sub: 'Banku, jollof, waakye, fufu, omotuo and more — cooked fresh daily and delivered to your door.',
          },
          {
            eyebrow: 'Authentic Ghanaian Cuisine',
            headline: ['Real Flavours,', ' Made Fresh', '\nEvery Day'],
            sub: 'Every dish crafted with traditional recipes, the finest ingredients, and a whole lot of love.',
          },
          {
            eyebrow: 'Catering · Delivery · Pickup',
            headline: ['Feeding Calgary', '’s Love for', '\nGhana'],
            sub: 'From family dinners to large events — we bring the taste of home straight to your table.',
          },
        ].map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6 sm:px-10 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          >
            <p className="text-[10px] font-bold tracking-[0.55em] uppercase mb-6"
              style={{ color: 'rgba(200,149,42,0.8)' }}>
              {slide.eyebrow}
            </p>

            <h1 className="font-serif text-white leading-[0.9] tracking-tight mb-6 drop-shadow-2xl"
              style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', textShadow: '0 4px 32px rgba(0,0,0,0.5)', whiteSpace: 'pre-line' }}>
              {slide.headline[0]}<em className="not-italic" style={{ color: '#C8952A' }}>{slide.headline[1]}</em>{slide.headline[2]}
            </h1>

            <div className="flex flex-col items-center gap-3 mb-10">
              <div className="h-[1px] w-14" style={{ backgroundColor: '#C8952A' }} />
              <p className="text-white/60 text-[14px] sm:text-[15px] leading-relaxed max-w-[420px]">
                {slide.sub}
              </p>
            </div>

            <div className="flex items-center justify-center gap-5 flex-wrap">
              <Link
                href="/menu"
                className="group inline-flex items-center gap-2.5 text-white font-bold text-[12px] uppercase tracking-[0.18em] px-8 py-4 rounded-full transition-all duration-300 active:scale-95 hover:scale-[1.02]"
                style={{ backgroundColor: '#C8952A', boxShadow: '0 8px 36px rgba(200,149,42,0.45)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#b8841f')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#C8952A')}
              >
                <i className="ri-restaurant-line text-base" />
                Order Now
              </Link>
              <Link
                href="/categories"
                className="group inline-flex items-center gap-2 text-[13px] font-semibold tracking-wide transition-all duration-300 text-white/55 hover:text-white/90"
              >
                Browse Menu
                <i className="ri-arrow-right-up-line text-xs opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </Link>
            </div>
          </div>
        ))}

        {/* ── Slide indicators ── */}
        <div className="relative z-20 mt-auto flex items-center justify-center gap-3 pb-6">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className="transition-all duration-500"
              aria-label={`Slide ${i + 1}`}
              style={{
                height: '2px',
                width: i === currentSlide ? '32px' : '16px',
                backgroundColor: i === currentSlide ? '#C8952A' : 'rgba(255,255,255,0.25)',
                borderRadius: '2px',
              }}
            />
          ))}
        </div>

        {/* ── Bottom info bar ── */}
        <div className="relative z-20 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-4 hidden sm:flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              { icon: 'ri-e-bike-line',    text: 'Delivery across Calgary' },
              { icon: 'ri-time-line',      text: '45–60 min delivery' },
              { icon: 'ri-map-pin-2-line', text: 'Cornerstone, NE Calgary' },
              { icon: 'ri-star-fill',      text: '5.0 · Loved by locals' },
            ].map(item => (
              <span key={item.text} className="flex items-center gap-2 text-[11.5px]"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                <i className={`${item.icon} text-sm flex-shrink-0`} style={{ color: 'rgba(200,149,42,0.65)' }} />
                {item.text}
              </span>
            ))}
          </div>
        </div>

      </section>

      {/* ═══════════════════════════════════════
          CATEGORIES
      ═══════════════════════════════════════ */}
      <section className="py-20 md:py-32 bg-gray-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="flex flex-col md:flex-row items-center md:items-end justify-between mb-16 gap-6 text-center md:text-left">
            <div>
              <span className="inline-block py-1.5 px-4 rounded-full bg-[#fdf9ec] text-[#C8952A] font-bold text-[10px] tracking-[0.28em] uppercase mb-5 border border-[#f5de8f]/80">Our Menu</span>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 tracking-tight">Browse by <em className="not-italic text-[#C8952A]">Category</em></h2>
            </div>
            <Link href="/categories" className="group hidden md:flex items-center gap-2.5 bg-white px-8 py-3.5 rounded-full text-gray-900 font-semibold text-sm transition-all duration-500 shadow-sm border border-gray-200 hover:shadow-md hover:border-[#e8c87a] hover:text-[#C8952A]">
              Explore All
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <path d="M3 11L11 3M5 3h6v6" />
              </svg>
            </Link>
          </AnimatedSection>

          <AnimatedGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 lg:gap-10">
            {categories.map((category) => (
              <Link href={`/menu?category=${category.slug}`} key={category.id} className="group cursor-pointer block relative outline-none">
                <div className="aspect-[4/3] rounded-[24px] overflow-hidden relative bg-gray-100 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] transition-all duration-700 transform group-hover:-translate-y-1.5">
                  <div className="absolute inset-0 bg-gray-200" />
                  <Image
                    src={category.image || category.image_url || '/logo.png' + encodeURIComponent(category.name)}
                    alt={category.name}
                    fill
                    className="object-cover object-center transition-all duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={85}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-700 pointer-events-none" />
                  <div className="absolute top-4 left-4 z-10">
                    <span className="inline-flex items-center h-[20px] px-2.5 rounded-md bg-white/15 backdrop-blur-md border border-white/20 text-[8px] font-bold uppercase tracking-[0.22em] text-white/90">Menu</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 z-10">
                    <div className="transform transition-transform duration-600 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-translate-y-1">
                      <h3 className="font-serif font-bold text-white text-xl sm:text-2xl tracking-tight mb-2.5 drop-shadow-lg">{category.name}</h3>
                      <div className="flex items-center gap-2 text-white/65 text-[12px] font-medium tracking-wide opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
                        View Dishes
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-400 group-hover:translate-x-1"><path d="M2 6h8M6 2l4 4-4 4" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </AnimatedGrid>

          <div className="mt-10 flex justify-center md:hidden">
            <Link href="/categories" className="flex items-center justify-center gap-2.5 bg-[#111111] text-white w-full px-8 py-4 rounded-2xl font-semibold text-sm transition-all duration-400 active:scale-[0.98]">
              Browse Full Menu
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 10.5L10.5 2.5M4.5 2.5h6v6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURED PRODUCTS
      ═══════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block py-1.5 px-4 rounded-full bg-[#fdf9ec] text-[#C8952A] font-bold text-[10px] tracking-[0.28em] uppercase mb-5 border border-[#f5de8f]/80">Featured</span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-gray-900 mb-4">Today&apos;s Favourites</h2>
            <p className="text-gray-500 text-[15px] max-w-md mx-auto leading-relaxed">Our most-loved dishes, made fresh and ready to order</p>
          </AnimatedSection>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
              {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <AnimatedGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
              {featuredProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || product.price)) : undefined;
                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.compare_at_price}
                    image={product.product_images?.[0]?.url || '/logo.png'}
                    rating={product.rating_avg || 5}
                    reviewCount={product.review_count || 0}
                    badge={product.featured ? 'Featured' : undefined}
                    inStock={product.status === 'active'}
                    moq={product.moq || 1}
                    hasVariants={hasVariants}
                    minVariantPrice={minVariantPrice}
                  />
                );
              })}
            </AnimatedGrid>
          )}

          <div className="text-center mt-16">
            <Link href="/menu" className="inline-flex items-center gap-3 justify-center bg-[#111111] text-white px-10 py-4 rounded-full font-semibold text-[13px] uppercase tracking-[0.15em] transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] group">
              See Full Menu
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-1"><path d="M2 6.5h9M7.5 2.5l4 4-4 4" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TRUST PILLARS
      ═══════════════════════════════════════ */}
      <section className="py-14 md:py-20 border-y border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-gray-100">
            {[
              { title: 'Authentic Recipes', desc: "Real Ghanaian flavours, the way they're meant to taste", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 6v6c0 5.25 3.5 9 8 10 4.5-1 8-4.75 8-10V6L12 2z" /><path d="M9 12l2 2 4-4" /></svg> },
              { title: 'Made Fresh Daily', desc: 'Cooked to order — never reheated, never frozen', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" /></svg> },
              { title: 'Customer First', desc: 'Your satisfaction is our priority, every single order', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg> },
              { title: 'Reliable Delivery', desc: 'Same-day delivery across Calgary and surrounding areas', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg> },
            ].map(item => (
              <div key={item.title} className="flex flex-col items-center text-center px-4 md:px-8 py-2 md:py-0 gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#fdf9ec] flex items-center justify-center text-[#C8952A] flex-shrink-0">{item.icon}</div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-[13px] mb-1.5 tracking-tight">{item.title}</h4>
                  <p className="text-gray-500 text-[11.5px] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsletterSection />

    </main>
  );
}