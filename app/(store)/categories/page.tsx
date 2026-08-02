import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maamekskitchen.ca';

export const metadata: Metadata = {
  title: 'Menu Categories',
  description: "Explore Maame K's Kitchen menu by category — rice dishes, soups & stews, grills, sides, drinks and more. Fresh authentic Ghanaian food delivered in Calgary.",
  keywords: ['Ghanaian food categories Calgary', 'banku', 'jollof', 'waakye', 'Ghanaian soups Calgary', 'African food menu Calgary'],
  alternates: { canonical: `${siteUrl}/categories` },
  openGraph: {
    title: "Menu Categories | Maame K's Kitchen",
    description: 'Browse all menu categories — rice dishes, soups, grills, sides, drinks and more.',
    url: `${siteUrl}/categories`,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: "Maame K's Kitchen Menu Categories" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Menu Categories | Maame K's Kitchen",
    description: 'Browse all menu categories — rice dishes, soups, grills, sides, drinks and more.',
  },
};
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import PageHero from '@/components/PageHero';

export const revalidate = 0;

// Food-appropriate icon + gradient accent per category slot
const FOOD_STYLES = [
  { icon: 'ri-restaurant-line',    grad: 'from-[#0d0d0d]/80 via-[#1a1a1a]/40 to-transparent', dot: 'bg-[#C8952A]' },
  { icon: 'ri-bowl-line',          grad: 'from-amber-900/80 via-amber-800/40 to-transparent',    dot: 'bg-amber-400'   },
  { icon: 'ri-fire-line',          grad: 'from-orange-900/80 via-orange-800/40 to-transparent',  dot: 'bg-orange-400'  },
  { icon: 'ri-leaf-line',          grad: 'from-[#111111]/80 via-[#1a1a1a]/40 to-transparent',    dot: 'bg-[#C8952A]'   },
  { icon: 'ri-cup-line',           grad: 'from-sky-900/80 via-sky-800/40 to-transparent',        dot: 'bg-sky-400'     },
  { icon: 'ri-cake-slice-line',    grad: 'from-rose-900/80 via-rose-800/40 to-transparent',      dot: 'bg-rose-400'    },
];

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  default: 'Made fresh daily from authentic Ghanaian recipes.',
};

export default async function CategoriesPage() {
  const { data: categoriesData } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, description, image_url, position')
    .eq('status', 'active')
    .order('position', { ascending: true });

  const categories = (categoriesData || []).map((c, i) => ({
    ...c,
    image:  c.image_url || '/logo.png',
    style:  FOOD_STYLES[i % FOOD_STYLES.length],
    desc:   c.description || DEFAULT_DESCRIPTIONS.default,
    // first card spans 2 cols for visual interest
    featured: i === 0,
  }));

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PageHero
        title="Our Menu"
        subtitle="Rice dishes, soups & stews, grills, sides, drinks and more — all made fresh daily from authentic Ghanaian recipes"
        backgroundImage="/home_hero_2.jpeg"
      />

      {/* ── Quick info strip ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-[12px] text-gray-500 font-medium">
          {[
            { icon: 'ri-time-line',         text: 'Made fresh · Mon – Sun 10am – 9pm' },
            { icon: 'ri-e-bike-line',        text: 'Same-day delivery across Calgary' },
            { icon: 'ri-map-pin-line',       text: 'Cornerstone, NE Calgary' },
            { icon: 'ri-shield-check-line',  text: 'Quality guaranteed or we remake it' },
          ].map(item => (
            <span key={item.text} className="flex items-center gap-1.5">
              <i className={`${item.icon} text-[#C8952A] text-[14px]`} />
              {item.text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Category grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 auto-rows-auto">
            {categories.map((cat, idx) => (
              <Link
                key={cat.id}
                href={`/menu?category=${cat.slug}`}
                className={`group relative flex flex-col rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.14)] transition-all duration-700 hover:-translate-y-1.5 cursor-pointer ${
                  cat.featured ? 'md:col-span-2 lg:col-span-2' : ''
                }`}
              >
                {/* ── Image ── */}
                <div className={`relative overflow-hidden bg-gray-100 ${cat.featured ? 'h-72 sm:h-80' : 'h-52 sm:h-60'}`}>
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover object-center transition-transform duration-[1200ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-[1.06]"
                  />

                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${cat.style.grad} opacity-75 group-hover:opacity-90 transition-opacity duration-700`} />

                  {/* Top-left badge */}
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-white/90 text-[10px] font-bold tracking-[0.2em] uppercase">
                      <span className={`w-1.5 h-1.5 rounded-full ${cat.style.dot}`} />
                      Menu Section
                    </span>
                  </div>

                  {/* Icon + category name overlay (bottom of image) */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 z-10 flex items-end justify-between">
                    <h3 className={`font-black text-white tracking-tight drop-shadow-lg leading-tight transition-transform duration-500 group-hover:-translate-y-0.5 ${cat.featured ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
                      {cat.name}
                    </h3>
                    <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-[#C8952A]/40 transition-all duration-500">
                      <i className={`${cat.style.icon} text-white text-xl`} />
                    </div>
                  </div>
                </div>

                {/* ── Card body ── */}
                <div className="px-6 py-5 flex items-center justify-between gap-4">
                  <p className="text-gray-500 text-[13.5px] font-light leading-relaxed line-clamp-2 flex-1">
                    {cat.desc}
                  </p>

                  <div className="flex items-center gap-2 flex-shrink-0 text-[12px] font-bold text-[#C8952A] group-hover:text-[#a07020] transition-colors duration-300 whitespace-nowrap">
                    Order Now
                    <div className="w-7 h-7 rounded-full bg-[#fdf9ec] group-hover:bg-[#fdf9ec] flex items-center justify-center transition-all duration-500 group-hover:translate-x-0.5">
                      <i className="ri-arrow-right-line text-[13px] text-[#C8952A]" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-full bg-[#fdf9ec] flex items-center justify-center mx-auto mb-6">
              <i className="ri-restaurant-line text-4xl text-[#C8952A]" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Menu Coming Soon</h3>
            <p className="text-gray-500 mb-8">We are adding our menu sections. Check back shortly!</p>
            <Link href="/contact" className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#111111] text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              <i className="ri-phone-line" /> Contact Us
            </Link>
          </div>
        )}
      </div>

      {/* ── How to Order strip ── */}
      <div className="bg-white border-y border-gray-100 py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.3em] text-gray-400 mb-10">How It Works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 text-center">
            {[
              { step: '01', icon: 'ri-restaurant-2-line', title: 'Browse the Menu',     desc: 'Pick a section, find your dish, choose your portion size.' },
              { step: '02', icon: 'ri-shopping-bag-line',  title: 'Place Your Order',    desc: 'Add to cart, leave any special instructions, and checkout.' },
              { step: '03', icon: 'ri-e-bike-line',        title: 'Receive Your Food',   desc: 'Same-day delivery across Calgary or pickup from Cornerstone.' },
            ].map(s => (
              <div key={s.step} className="flex flex-col items-center gap-4">
                <div className="relative w-14 h-14 rounded-2xl bg-[#fdf9ec] flex items-center justify-center">
                  <i className={`${s.icon} text-2xl text-[#C8952A]`} />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#111111] text-white text-[10px] font-black flex items-center justify-center">{s.step}</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-[15px] mb-1">{s.title}</h4>
                  <p className="text-gray-500 text-[13px] leading-relaxed max-w-[220px] mx-auto">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA Banner ── */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 flex justify-center bg-[#fafaf9]">
        <div className="relative w-full max-w-5xl rounded-[2.5rem] overflow-hidden bg-[#0d0d0d] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] group">
          <div className="absolute top-0 right-0 -m-20 w-72 h-72 bg-[#C8952A]/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-[#C8952A]/30 transition-colors duration-1000" />
          <div className="absolute bottom-0 left-0 -m-20 w-64 h-64 bg-[#111111]/10 rounded-full blur-[70px] pointer-events-none" />

          <div className="relative z-10 px-8 py-16 sm:p-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl flex items-center justify-center mb-8">
              <i className="ri-restaurant-line text-3xl text-[#e8b428]" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-5 text-white tracking-tight leading-tight">
              Don&apos;t See What<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-[#0d0d0d]">You&apos;re Craving?</span>
            </h2>
            <p className="text-[15px] text-white/55 mb-10 leading-relaxed max-w-xl font-light">
              Search our full menu or reach out — we love hearing from our customers and are always happy to help with special requests.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/menu"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white text-gray-900 font-bold text-sm transition-all duration-500 hover:scale-105 shadow-lg"
              >
                <i className="ri-search-line text-[#C8952A]" />
                Browse Full Menu
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-medium text-sm transition-all duration-500 hover:bg-white/20 hover:scale-105 backdrop-blur-md"
              >
                <i className="ri-phone-line text-[#e8b428]" />
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}