'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AboutPage() {
  usePageTitle('Our Story');
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Maame K’s Kitchen';

  const values = [
    {
      icon: 'ri-verified-badge-line',
      title: 'Authentic Recipes',
      description: 'Every dish follows traditional Ghanaian methods and ingredients — the way your grandmother would make it.',
    },
    {
      icon: 'ri-restaurant-line',
      title: 'Made Fresh Daily',
      description: 'We cook to order. Nothing pre-packaged, nothing reheated — just real food made with care every single day.',
    },
    {
      icon: 'ri-heart-line',
      title: 'A Taste of Home',
      description: 'For Ghanaians missing home and for anyone curious about West African cuisine — our kitchen is for everyone.',
    },
    {
      icon: 'ri-e-bike-line',
      title: 'Same-Day Delivery',
      description: 'Hot, fresh meals delivered across Calgary — from our kitchen to your door the same day you order.',
    },
  ];

  const stats = [
    { value: '10+',    label: 'Ghanaian dishes on the menu' },
    { value: '100%',   label: 'Made fresh to order'         },
    { value: '1 hr',   label: 'Average delivery time'       },
    { value: 'YYC',    label: 'Proudly serving Calgary'     },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ---- Hero / Intro ---- */}
      <section className="relative bg-[#0d0d0d] overflow-hidden">
        {/* Glows */}
        {/* Hero background photo */}
        <Image
          src="/home_hero_1.webp"
          alt="Maame K kitchen"
          fill
          sizes="100vw"
          className="object-cover object-center opacity-35"
          priority
          unoptimized
        />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#111111]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#111111]/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d]/40 to-[#0d0d0d]/75 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-8 py-24 sm:py-32 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#e8b428] text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#C8952A]" />
            Cornerstone, NE Calgary · Est. 2026
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6">
            Real Ghanaian Food,<br />
            <em className="not-italic text-[#e8b428]">Made With Love</em>
          </h1>
          <p className="text-lg sm:text-xl text-white/55 font-light max-w-2xl mx-auto leading-relaxed">
            {siteName} brings the flavours of Ghana — banku, jollof, waakye, fufu, omotuo, soups and stews — to the heart of Calgary, made fresh every day.
          </p>
        </div>
      </section>

      {/* ---- Stats strip ---- */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:divide-x divide-gray-100 text-center">
          {stats.map(s => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 px-3">
              <span className="text-xl sm:text-2xl font-black text-[#C8952A]">{s.value}</span>
              <span className="text-[11px] text-gray-500 font-medium leading-snug">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Our Story ---- */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-8 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Image */}
          <div className="relative group order-2 lg:order-1">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-[#fdf9ec] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] transition-transform duration-700 group-hover:scale-[1.01]">
              <Image
                src="/about-me.webp"
                alt={`${siteName} kitchen`}
                fill
                sizes="(min-width: 1024px) 560px, 90vw"
                className="object-cover object-center"
                priority
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-5 -right-4 sm:-right-6 bg-[#111111] text-white rounded-2xl px-5 py-4 shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8d5a3] mb-0.5">Maame K</p>
              <p className="text-sm font-black">10:00 AM – 9:00 PM</p>
            </div>
            {/* Glow */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#fdf9ec]/50 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          </div>

          {/* Text */}
          <div className="order-1 lg:order-2">
            <span className="inline-block py-1.5 px-4 rounded-full bg-[#fdf9ec] text-[#C8952A] font-bold text-[10px] tracking-[0.28em] uppercase mb-6 border border-[#f5de8f]">
              The Beginning
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-8 tracking-tight leading-tight">
              How It All Started
            </h2>
            <div className="space-y-5 text-[17px] text-gray-500 leading-relaxed font-light">
              <p>
                <strong className="font-semibold text-gray-900">{siteName}</strong> was founded with one simple goal — to bring real, authentic Ghanaian food to Calgary. The kind of cooking that reminds you of home.
              </p>
              <p>
                From banku and tilapia to jollof rice, waakye, fufu, omotuo, groundnut soup, and palm nut stew — every dish is prepared from scratch using traditional methods and the freshest ingredients we can find.
              </p>
              <p>
                Whether you grew up on these flavours or you&apos;re tasting Ghanaian food for the very first time — you&apos;re welcome at our table.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#111111] hover:bg-[#111111] text-white rounded-full font-bold text-sm transition-all duration-300 hover:shadow-[0_4px_20px_rgba(200,149,42,0.3)] hover:scale-[1.02]"
              >
                <i className="ri-restaurant-line" />
                Browse Our Menu
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-gray-200 text-gray-700 hover:border-[#C8952A]/50 hover:text-[#C8952A] rounded-full font-semibold text-sm transition-all duration-300"
              >
                Get In Touch
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Chop Bar Experience ---- */}
      <section className="py-16 md:py-24 bg-[#0d0d0d] text-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-8">
          <span className="inline-block py-1.5 px-4 rounded-full bg-white/10 text-[#e8b428] font-bold text-[10px] tracking-[0.28em] uppercase mb-6 border border-white/10">
            Community Event
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mb-6 tracking-tight">
            The Chop Bar Experience
          </h2>
          <p className="text-lg text-white/65 leading-relaxed font-light max-w-3xl mb-6">
            We host a food fest called <strong className="text-white font-semibold">The Chop Bar Experience</strong> — a community gathering where you can <strong className="text-white font-semibold">dine in or take out</strong>, enjoy authentic Ghanaian food, and connect with people in a warm, social atmosphere. It&apos;s more than a meal — it&apos;s meeting neighbours, sharing stories, and celebrating culture together in Cornerstone, NE Calgary.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/events" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#C8952A] hover:bg-[#b88425] text-white rounded-full font-bold text-sm transition-all">
              <i className="ri-calendar-event-line" /> See Events
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/25 text-white hover:bg-white/10 rounded-full font-semibold text-sm transition-all">
              Book Catering
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Our Mission ---- */}
      <section className="py-10 bg-gray-50/60 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-8 grid md:grid-cols-2 gap-5">

          {/* Card 1 */}
          <div className="group relative bg-white p-6 sm:p-8 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-700 hover:-translate-y-1 overflow-hidden ring-1 ring-gray-900/5">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-[#fdf9ec]/60 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="relative z-10 w-10 h-10 bg-[#fdf9ec] rounded-xl flex items-center justify-center mb-5 border border-[#f5de8f] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
              <i className="ri-restaurant-line text-lg text-[#C8952A]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2.5 tracking-tight">
                Real Ghanaian Flavours
              </h3>
              <p className="text-gray-500 text-[13px] leading-relaxed font-light">
                We cook the way Ghanaian mothers and grandmothers cook — patiently, with the right ingredients, and the right techniques. No shortcuts, no compromises on flavour.
              </p>
            </div>
            <div className="mt-5 w-8 h-0.5 bg-[#f5de8f] rounded-full group-hover:bg-[#111111] group-hover:w-full transition-all duration-700 ease-out" />
          </div>

          {/* Card 2 */}
          <div className="group relative bg-white p-6 sm:p-8 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-700 hover:-translate-y-1 overflow-hidden ring-1 ring-gray-900/5">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-[#fdf9ec]/60 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="relative z-10 w-10 h-10 bg-[#fdf9ec] rounded-xl flex items-center justify-center mb-5 border border-[#f5de8f] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
              <i className="ri-heart-line text-lg text-[#C8952A]" />
            </div>
            <div className="relative z-10">
              <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2.5 tracking-tight">
                A Taste of Home in Calgary
              </h3>
              <p className="text-gray-500 text-[13px] leading-relaxed font-light">
                Whether you grew up in Ghana, West Africa, or anywhere else in the world — our food is here to remind you of home. And if you&apos;re new to Ghanaian cuisine, welcome. You&apos;re going to love it.
              </p>
            </div>
            <div className="mt-5 w-8 h-0.5 bg-[#f5de8f] rounded-full group-hover:bg-[#111111] group-hover:w-full transition-all duration-700 ease-out" />
          </div>
        </div>
      </section>

      {/* ---- Values ---- */}
      <section className="relative py-12 lg:py-16 overflow-hidden bg-white border-b border-gray-100">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fdf9ec]/50 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-8 relative z-10">
          <div className="text-center mb-8">
            <span className="inline-block py-1 px-4 rounded-full bg-[#fdf9ec] text-[#C8952A] font-bold text-[10px] tracking-[0.28em] uppercase mb-4 border border-[#f5de8f]">
              What We Stand For
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 tracking-tight">Why Order From Us?</h2>
            <p className="text-[13px] text-gray-500 max-w-xl mx-auto font-light">
              Authentic Ghanaian cooking, made fresh, delivered across Calgary.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {values.map((v, idx) => (
              <div
                key={idx}
                className="group relative bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-700 hover:-translate-y-1 overflow-hidden flex flex-col"
              >
                <div className="absolute -top-6 -right-4 text-[100px] font-black text-gray-50 select-none pointer-events-none leading-none z-0">
                  {idx + 1}
                </div>
                <div className="relative z-10 w-10 h-10 bg-[#fdf9ec] rounded-xl flex items-center justify-center mb-4 border border-[#f5de8f] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
                  <i className={`${v.icon} text-lg text-[#C8952A]`} />
                </div>
                <h3 className="relative z-10 text-[15px] font-bold text-gray-900 mb-2 tracking-tight">{v.title}</h3>
                <p className="relative z-10 text-gray-500 text-[12px] leading-relaxed font-light mb-5">{v.description}</p>
                <div className="mt-auto w-6 h-0.5 bg-[#f5de8f] rounded-full group-hover:bg-[#111111] group-hover:w-full transition-all duration-700 ease-out" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="bg-white py-10 lg:py-14 px-4 sm:px-6 lg:px-8 flex justify-center">
        <div className="relative w-full max-w-5xl rounded-3xl overflow-hidden bg-[#111111] shadow-[0_20px_60px_-15px_rgba(200,149,42,0.3)] group">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-white/[0.05] rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0d0d]/30 pointer-events-none" />
          <div className="relative z-10 px-8 py-12 sm:px-16 sm:py-14 text-center flex flex-col items-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#e8d5a3] text-[10px] font-bold tracking-[0.25em] uppercase mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8952A] animate-pulse" />
              Ready to Order?
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-3 leading-tight">
              Hungry for <em className="not-italic text-[#e8d5a3]">more?</em>
            </h2>
            <p className="text-[13px] text-white/55 mb-8 max-w-lg mx-auto font-light leading-relaxed">
              Browse our full menu of authentic Ghanaian dishes — banku, jollof, waakye, fufu, soups and stews. Delivered hot to your door across Calgary.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2.5 px-7 py-3 rounded-full bg-white text-[#C8952A] font-bold text-sm transition-all duration-500 hover:bg-[#fdf9ec] hover:scale-105 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
              >
                <i className="ri-restaurant-line" />
                View Full Menu
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-semibold text-sm transition-all duration-300 hover:bg-white/20 backdrop-blur-md"
              >
                Catering Enquiry
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}




