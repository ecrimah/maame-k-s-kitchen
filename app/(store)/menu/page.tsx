/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import PageHero from '@/components/PageHero';
import { getAvailabilityMode, getPreorderLeadHours, isSaturdayOnly } from '@/lib/product-availability';

const DIETARY_OPTIONS = [
  { id: 'halal',        label: 'Halal',        icon: 'ri-award-line' },
  { id: 'vegetarian',   label: 'Vegetarian',    icon: 'ri-leaf-line' },
  { id: 'spicy',        label: 'Spicy',         icon: 'ri-fire-line' },
  { id: 'gluten-free',  label: 'Gluten-Free',   icon: 'ri-shield-check-line' },
];

function ShopContent() {
  usePageTitle('Our Menu');
  const searchParams = useSearchParams();

  const [products, setProducts]       = useState<any[]>([]);
  const [allFetched, setAllFetched]   = useState<any[]>([]);
  const [categories, setCategories]   = useState<any[]>([{ id: 'all', name: 'Full Menu', count: 0 }]);
  const [loading, setLoading]         = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [maxPrice, setMaxPrice]               = useState(80);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [sortBy, setSortBy]                   = useState('popular');
  const [isFilterOpen, setIsFilterOpen]       = useState(false);
  const [page, setPage]                       = useState(1);
  const productsPerPage = 9;

  useEffect(() => {
    const category = searchParams.get('category');
    const sort     = searchParams.get('sort');
    if (category) setSelectedCategory(category);
    if (sort)     setSortBy(sort);
  }, [searchParams]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/storefront/categories');
        if (res.ok) {
          const data = await res.json();
          if (data) setCategories(data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const search   = searchParams.get('search');
        const cacheKey = `menu:${selectedCategory}:${search || ''}:${maxPrice}:${sortBy}:${page}`;

        const { data, count, error } = await cachedQuery<{ data: any; count: any; error: any }>(
          cacheKey,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name, slug),
                product_images(url, position),
                product_variants(id, name, price, quantity, option1, image_url)
              `, { count: 'exact' })
              .neq('status', 'archived');

            if (search) query = query.ilike('name', `%${search}%`);

            if (selectedCategory === 'saturday-menu') {
              // Saturday menu is driven by the dish's available_days, not category,
              // so it lines up with the admin Saturday Menu page.
              query = query.contains('available_days', ['saturday']);
            } else if (selectedCategory !== 'all') {
              const categoryObj = categories.find((c: any) => c.slug === selectedCategory);
              if (categoryObj && categoryObj.id) {
                const childIds = categories.filter((c: any) => c.parent_id === categoryObj.id).map((c: any) => c.id);
                const allIds = [categoryObj.id, ...childIds].filter(Boolean);
                query = query.in('category_id', allIds);
              }
            }

            if (maxPrice < 80) {
              query = query.lte('price', maxPrice);
            }

            switch (sortBy) {
              case 'price-low':  query = query.order('price', { ascending: true });       break;
              case 'price-high': query = query.order('price', { ascending: false });      break;
              case 'new':        query = query.order('created_at', { ascending: false }); break;
              default:           query = query.order('created_at', { ascending: false }); break;
            }

            const from = (page - 1) * productsPerPage;
            const to   = from + productsPerPage - 1;
            query = query.range(from, to);
            return query as any;
          },
          2 * 60 * 1000
        );

        if (error) throw error;

        if (data) {
          const formatted = data.map((p: any) => {
            const variants          = p.product_variants || [];
            const hasVariants       = variants.length > 0;
            const minVariantPrice   = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
            const hasSpecial = p.compare_at_price > p.price;
            const isPreorder = getAvailabilityMode(p) === 'preorder';
            const saturdayOnly = isSaturdayOnly({ ...p, categories: p.categories });
            const badge = isPreorder ? 'Pre-order' : saturdayOnly ? 'Saturday' : hasSpecial ? 'Special' : undefined;
            return {
              id:            p.id,
              slug:          p.slug,
              name:          p.name,
              price:         p.price,
              originalPrice: p.compare_at_price,
              image:         p.product_images?.sort((a: any, b: any) => a.position - b.position)?.[0]?.url || '/logo.png',
              rating:        p.rating_avg || 0,
              reviewCount:   0,
              badge,
              preorder:      isPreorder,
              preorderLeadHours: getPreorderLeadHours(p),
              saturdayOnly,
              inStock:       p.status === 'active',
              moq:           p.moq || 1,
              category:      p.categories?.name,
              hasVariants,
              minVariantPrice,
              colorVariants: [],
            };
          });

          setAllFetched(formatted);
          setTotalProducts(count || 0);
        }
      } catch (err) {
        console.error('Error fetching dishes:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedCategory, maxPrice, sortBy, page, searchParams, categories]);

  // Client-side dietary filter
  useEffect(() => {
    if (selectedDietary.length === 0) {
      setProducts(allFetched);
      return;
    }
    const filtered = allFetched.filter(p => {
      const text = (p.name + ' ' + (p.category || '')).toLowerCase();
      return selectedDietary.every(d => {
        if (d === 'vegetarian') return text.includes('veg') || text.includes('plant');
        if (d === 'spicy')      return text.includes('spic') || text.includes('pepper') || text.includes('hot') || text.includes('chili');
        return true; // halal / gluten-free assumed store-wide; refine with DB tags later
      });
    });
    setProducts(filtered);
  }, [allFetched, selectedDietary]);

  const totalPages  = Math.ceil(totalProducts / productsPerPage);

  const toggleDietary = (id: string) => {
    setSelectedDietary(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    setPage(1);
  };

  const clearAll = () => {
    setSelectedCategory('all');
    setMaxPrice(80);
    setSelectedDietary([]);
    setPage(1);
    setIsFilterOpen(false);
  };

  return (
    <main className="min-h-screen bg-white">
      <PageHero
        title="Our Menu"
        subtitle="Authentic Ghanaian cuisine made fresh daily — banku, jollof, waakye, fufu, omotuo, soups, stews & traditional sides"
        backgroundImage="/home_hero_1.webp"
      />

      {/* Quick category links — sit below hero (no negative margin; avoids hero clipping tabs) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-2 bg-white relative z-10 border-b border-gray-100">
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { label: 'Full Menu', slug: 'all' },
            { label: 'Saturday Menu', slug: 'saturday-menu' },
            { label: 'Salads & Sides', slug: 'sides' },
            { label: 'Pastries', slug: 'pastries' },
          ].map(({ label, slug }) => (
            <button
              key={slug}
              type="button"
              onClick={() => { setSelectedCategory(slug); setPage(1); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors cursor-pointer ${
                selectedCategory === slug
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#C8952A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {selectedCategory === 'saturday-menu' && (
          <p className="text-center text-sm text-[#C8952A] mt-3 font-medium">
            <i className="ri-calendar-line mr-1"></i>
            Saturday specials — made fresh every Saturday in Cornerstone, NE Calgary
          </p>
        )}
      </div>

      {/* Mobile filter bar */}
      <div className="lg:hidden bg-white border-b border-gray-200 py-4 px-4 z-20">
        <div className="flex justify-between items-center">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 text-gray-900 font-medium"
          >
            <i className="ri-filter-3-line text-xl" />
            <span>Filter</span>
            {(selectedDietary.length > 0 || maxPrice < 80 || selectedCategory !== 'all') && (
              <span className="w-5 h-5 rounded-full bg-[#111111] text-white text-[10px] font-bold flex items-center justify-center">
                {selectedDietary.length + (maxPrice < 80 ? 1 : 0) + (selectedCategory !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
          <span className="text-sm text-gray-500">{totalProducts} dishes</span>
        </div>
      </div>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-10">

            {/* â”€â”€ Sidebar â”€â”€ */}
            <aside className={`${isFilterOpen ? 'fixed inset-0 z-50 bg-white overflow-y-auto' : 'hidden'} lg:block lg:w-60 lg:flex-shrink-0`}>
              <div className="lg:sticky lg:top-24">
                <div className="bg-white lg:bg-transparent p-6 lg:p-0 space-y-7">

                  {/* Mobile header */}
                  <div className="flex items-center justify-between lg:hidden">
                    <h2 className="text-xl font-bold text-gray-900">Filter Menu</h2>
                    <button onClick={() => setIsFilterOpen(false)} className="w-10 h-10 flex items-center justify-center text-gray-700">
                      <i className="ri-close-line text-2xl" />
                    </button>
                  </div>

                  {/* Menu Sections */}
                  <div>
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-gray-400 mb-3">Menu Sections</h3>
                    <div className="space-y-0.5">
                      <button
                        onClick={() => { setSelectedCategory('all'); setPage(1); setIsFilterOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedCategory === 'all' ? 'bg-[#fdf9ec] text-[#C8952A]' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        Full Menu
                      </button>
                      {categories.filter(c => !c.parent_id && c.id !== 'all').map(parent => {
                        const subs          = categories.filter(c => c.parent_id === parent.id);
                        const isSelected    = selectedCategory === parent.slug;
                        const isChildSel    = subs.some(s => s.slug === selectedCategory);
                        return (
                          <div key={parent.id}>
                            <button
                              onClick={() => { setSelectedCategory(parent.slug); setPage(1); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${isSelected ? 'bg-[#fdf9ec] text-[#C8952A] font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                              {parent.name}
                            </button>
                            {subs.length > 0 && (isSelected || isChildSel) && (
                              <div className="ml-3 border-l-2 border-[#f5de8f] pl-2 mt-0.5 space-y-0.5">
                                {subs.map(child => (
                                  <button
                                    key={child.id}
                                    onClick={() => { setSelectedCategory(child.slug); setPage(1); setIsFilterOpen(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${selectedCategory === child.slug ? 'text-[#C8952A] font-medium bg-[#fdf9ec]' : 'text-gray-600 hover:bg-gray-50'}`}
                                  >
                                    {child.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-gray-400">Max Price</h3>
                      <span className="text-sm font-semibold text-[#C8952A]">
                        CA${maxPrice === 80 ? '80+' : maxPrice}
                      </span>
                    </div>
                    <input
                      type="range" min="10" max="80" step="5" value={maxPrice}
                      onChange={(e) => { setMaxPrice(parseInt(e.target.value)); setPage(1); }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-[11px] text-gray-400 mt-2">
                      <span>CA$10</span><span>CA$80+</span>
                    </div>
                  </div>

                  {/* Dietary */}
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-gray-400 mb-3">Dietary</h3>
                    <div className="space-y-1.5">
                      {DIETARY_OPTIONS.map(opt => {
                        const active = selectedDietary.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleDietary(opt.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${active ? 'border-[#C8952A] bg-[#fdf9ec] text-[#C8952A] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                          >
                            <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${active ? 'bg-[#111111] border-[#C8952A]' : 'border-gray-300'}`}>
                              {active && <i className="ri-check-line text-white text-[10px]" />}
                            </span>
                            <i className={`${opt.icon} text-[15px]`} />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-gray-100 pt-5 space-y-2">
                    <button
                      onClick={clearAll}
                      className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                    >
                      Clear All Filters
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="w-full bg-[#111111] hover:bg-[#111111] text-white py-3 rounded-xl font-semibold text-sm transition-colors lg:hidden"
                    >
                      Show Dishes
                    </button>
                  </div>

                </div>
              </div>
            </aside>

            {/* â”€â”€ Main grid â”€â”€ */}
            <div className="flex-1 min-w-0">

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{products.length}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-gray-900">{totalProducts}</span>
                  {' '}dishes
                  {selectedDietary.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fdf9ec] text-[#C8952A] text-[11px] font-medium">
                      {selectedDietary.join(' · ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 whitespace-nowrap">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] cursor-pointer"
                  >
                    <option value="popular">Most Ordered</option>
                    <option value="new">Newly Added</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Grid */}
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                  {[...Array(6)].map((_, i) => <ProductCardSkeleton key={i} />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
                    {products.map(p => <ProductCard key={p.id} {...p} />)}
                  </div>

                  {products.length === 0 && (
                    <div className="text-center py-24">
                      <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-[#fdf9ec] rounded-full">
                        <i className="ri-restaurant-line text-4xl text-[#C8952A]" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">No Dishes Found</h3>
                      <p className="text-gray-500 mb-8">Try a different section or clear your filters</p>
                      <button
                        onClick={clearAll}
                        className="inline-flex items-center bg-[#111111] hover:bg-[#111111] text-white px-8 py-3 rounded-xl font-semibold transition-colors"
                      >
                        View Full Menu
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-16 flex justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="ri-arrow-left-s-line text-xl text-gray-700" />
                  </button>
                  <span className="px-4 py-2 font-medium text-gray-700 text-sm self-center">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-10 h-10 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="ri-arrow-right-s-line text-xl text-gray-700" />
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}

