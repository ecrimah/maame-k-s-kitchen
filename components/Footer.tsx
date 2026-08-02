"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useCMS } from '@/context/CMSContext';

function NavColumn({ title, links }: {
  title: string;
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.05] last:border-0 lg:border-none">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 lg:py-0 lg:cursor-default"
        aria-expanded={open}
      >
        <span className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-white/30">{title}</span>
        <svg
          width="11" height="11" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          className={`lg:hidden text-white/20 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      <ul className={`
        overflow-hidden transition-all duration-300 space-y-2.5
        ${open ? 'max-h-96 pb-4' : 'max-h-0 pb-0'}
        lg:max-h-none lg:overflow-visible lg:pt-4 lg:pb-0
      `}>
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-white/50 hover:text-white text-[12px] font-light transition-colors duration-300 block leading-none"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || "Maame K’s Kitchen";
  const siteLogo = getSetting('site_logo') || '/logo.png';
  const socialTiktok = getSetting('social_tiktok') || '';
  const socialTiktok2 = getSetting('social_tiktok_secondary') || '';
  const socialInstagram = getSetting('social_instagram') || '';
  const socialSnapchat = getSetting('social_snapchat') || '';
  const socialYoutube = getSetting('social_youtube') || '';
  const socialTwitter = getSetting('social_twitter') || '';
  const socialFacebook = getSetting('social_facebook') || '';
  const contactPhone = getSetting('contact_phone') || getSetting('phone_1') || '';

  const socials = [
    { href: socialTiktok, icon: 'ri-tiktok-fill', label: 'TikTok' },
    { href: socialTiktok2, icon: 'ri-tiktok-fill', label: 'TikTok 2' },
    { href: socialInstagram, icon: 'ri-instagram-line', label: 'Instagram' },
    { href: socialSnapchat, icon: 'ri-snapchat-fill', label: 'Snapchat' },
    { href: socialYoutube, icon: 'ri-youtube-fill', label: 'YouTube' },
    { href: socialTwitter, icon: 'ri-twitter-x-fill', label: 'X' },
    { href: socialFacebook, icon: 'ri-facebook-fill', label: 'Facebook' },
  ].filter(s => s.href);

  return (
    <footer className="relative mt-10">
      <div className="relative bg-[#0d0d0d] rounded-t-[2rem] overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[rgba(200,149,42,0.25)] to-transparent" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-10 pb-6">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-8 border-b border-white/10">

            {/* Brand Column */}
            <div className="lg:col-span-4 space-y-4 lg:pr-8">
              <Link href="/" className="inline-block transition-opacity duration-400 hover:opacity-70">
                <Image
                  src="/footer-logo.webp"
                  alt={siteName}
                  width={500}
                  height={500}
                  className="h-9 w-auto object-contain object-left"
                  unoptimized
                />
              </Link>

              <p className="text-white/45 text-[12px] leading-relaxed font-light max-w-[240px]">
                Authentic Ghanaian flavours, made fresh in Cornerstone, NE Calgary.
              </p>

              {socials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {socials.map((social, i) => (
                    <a
                      key={i}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-white/45 hover:text-white hover:border-white/40 hover:bg-white/10 transition-all duration-300"
                    >
                      <i className={`${social.icon} text-[13px]`} />
                    </a>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-white/30">Hours</p>
                <p className="text-white/50 text-[12px] font-light">Mon &ndash; Sun &nbsp; 10:00 AM &ndash; 9:00 PM MT</p>
                <p className="text-white/35 text-[11px] font-light">Cornerstone, NE Calgary</p>
                {contactPhone && (
                  <a href={`tel:${contactPhone}`} className="block text-white/45 hover:text-white text-[12px] font-light transition-colors duration-300">
                    {contactPhone}
                  </a>
                )}
              </div>
            </div>

            {/* Nav Columns */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-0 sm:gap-8 lg:gap-16">
              <NavColumn
                title="Menu"
                links={[
                  { href: '/menu', label: 'Full Menu' },
                  { href: '/categories', label: 'Categories' },
                  { href: '/menu?sort=new', label: 'New on the Menu' },
                  { href: '/menu?sort=popular', label: 'Most Loved' },
                ]}
              />
              <NavColumn
                title="Support"
                links={[
                  { href: '/contact', label: 'Contact Us' },
                  { href: '/order-tracking', label: 'Track Order' },
                  { href: '/shipping', label: 'Delivery & Pickup' },
                  { href: '/returns', label: 'Order Issues' },
                ]}
              />
              <NavColumn
                title="Company"
                links={[
                  { href: '/about', label: 'Our Story' },
                  { href: '/privacy', label: 'Privacy Policy' },
                  { href: '/terms', label: 'Terms of Service' },
                  { href: '/admin', label: 'Admin' },
                ]}
              />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-5 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-white/35 text-[11px] tracking-wide font-light">
              &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-white/30">
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium">Visa</span>
              <span className="w-px h-3 bg-white/20" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium">Mastercard</span>
              <span className="w-px h-3 bg-white/20" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium">Interac</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

