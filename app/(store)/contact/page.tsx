"use client";

import { useState, useEffect } from 'react';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRecaptcha } from '@/hooks/useRecaptcha';

const SUBJECTS = [
  'Order Inquiry',
  'Delivery Question',
  'Catering / Bulk Order',
  'Special Dietary Request',
  'Feedback / Compliment',
  'Issue with My Order',
  'Other',
];

const HOURS = [
  { day: 'Monday – Friday', time: '10:00 AM – 9:00 PM' },
  { day: 'Saturday',        time: '10:00 AM – 9:00 PM' },
  { day: 'Sunday',          time: '10:00 AM – 9:00 PM' },
];

const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Browse our menu online, add dishes to your cart, and checkout. You can choose delivery or pickup at Cornerstone, NE Calgary.',
  },
  {
    q: 'What are your delivery times?',
    a: 'Same-day delivery across Calgary for orders placed before 8 PM. Pickup is typically ready within 30–60 minutes.',
  },
  {
    q: 'Do you cater events?',
    a: 'Yes! We cater for events big and small. Fill out the form and select "Catering / Bulk Order" so we can get back to you with options.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept Visa, Mastercard, Interac, and cash on pickup. All online payments are secure.',
  },
];

export default function ContactPage() {
  usePageTitle('Contact Us');
  const { getSetting } = useCMS();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitStatus, setSubmitStatus]   = useState<'idle' | 'success' | 'error'>('idle');
  const [openFaq, setOpenFaq]             = useState<number | null>(null);
  const { getToken, verifying }           = useRecaptcha();

  const contactPhone   = getSetting('contact_phone')   || '(587) 582-2421';
  const contactAddress = getSetting('contact_address') || 'Cornerstone, NE Calgary';
  const siteName       = getSetting('site_name')       || 'Maame K’s Kitchen';
  const tiktokMain     = getSetting('social_tiktok')   || '';
  const tiktokJoy      = getSetting('social_tiktok_secondary') || '';
  const instagram      = getSetting('social_instagram') || '';

  const phoneLines = contactPhone.split(/·|\/|&|\||,/).map((s: string) => s.trim()).filter(Boolean);
  const DEFAULT_COUNTRY_CODE = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || '1';
  const toWhatsAppDigits = (raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (d.startsWith(DEFAULT_COUNTRY_CODE)) return d;
    if (d.startsWith('0'))  return `${DEFAULT_COUNTRY_CODE}${d.slice(1)}`;
    if (d.length === 9)     return `${DEFAULT_COUNTRY_CODE}${d}`;
    return d;
  };
  const waLink = phoneLines[0] ? `https://wa.me/${toWhatsAppDigits(phoneLines[0])}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    const isHuman = await getToken('contact');
    if (!isHuman) { setSubmitStatus('error'); setIsSubmitting(false); return; }
    try {
      const { error } = await supabase.from('contact_submissions').insert({
        name: formData.name, email: formData.email, phone: formData.phone,
        subject: formData.subject, message: formData.message,
      });
      if (error) console.log('Note: contact_submissions table may not exist yet');
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contact', payload: formData }),
      }).catch(console.error);
      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = 'w-full px-5 py-4 bg-gray-50/60 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-300 focus:shadow-[0_4px_20px_rgba(0,0,0,0.04)] focus:ring-0 transition-all duration-300 outline-none text-gray-800 placeholder:text-gray-400 text-[15px]';

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Get In Touch"
        subtitle="Questions, catering enquiries, or special requests — we would love to hear from you."
        backgroundImage="/home_hero_1.webp"
      />

      {/* ── Quick contact strip ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {[
            { icon: 'ri-phone-line',   label: phoneLines[0] || '(587) 582-2421', href: `tel:${(phoneLines[0] || '').replace(/\s/g, '')}` },
            { icon: 'ri-map-pin-line', label: 'Cornerstone, NE Calgary',          href: '#location' },
            { icon: 'ri-time-line',    label: 'Open daily 10 AM – 9 PM MT',       href: '#hours' },
          ].map(item => (
            <a key={item.label} href={item.href} className="flex items-center gap-2 text-[12.5px] text-gray-500 font-medium hover:text-[#C8952A] transition-colors">
              <i className={`${item.icon} text-[#C8952A] text-[15px]`} />
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-20">

          {/* ── Left: Form ── */}
          <div className="lg:col-span-7">
            <div className="mb-10">
              <span className="inline-block py-1.5 px-4 rounded-full bg-[#fdf9ec] text-[#C8952A] font-bold text-[10px] tracking-[0.28em] uppercase mb-5 border border-[#f5de8f]">Send a Message</span>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3 tracking-tight">How Can We Help?</h2>
              <p className="text-gray-500 font-light text-[16px]">We read every message and typically reply within a few hours during opening hours.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name + Email */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Full Name <span className="text-[#C8952A]">*</span></label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={field} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Email <span className="text-[#C8952A]">*</span></label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={field} placeholder="you@example.com" />
                </div>
              </div>

              {/* Phone + Subject */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Phone (optional)</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={field} placeholder="+1 XXX XXX XXXX" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Topic <span className="text-[#C8952A]">*</span></label>
                  <select required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className={field + ' cursor-pointer'}>
                    <option value="" disabled>Select a topic…</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Message <span className="text-[#C8952A]">*</span></label>
                  <span className="text-[11px] text-gray-400">{formData.message.length}/500</span>
                </div>
                <textarea required rows={5} maxLength={500} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className={field + ' resize-none'} placeholder="Tell us how we can help you…" />
              </div>

              {/* Catering note */}
              {formData.subject === 'Catering / Bulk Order' && (
                <div className="flex items-start gap-3 p-4 bg-[#fdf9ec] border border-[#f5de8f] rounded-2xl text-[13px] text-[#C8952A] animate-in fade-in duration-300">
                  <i className="ri-information-line text-lg flex-shrink-0 mt-0.5" />
                  <p>For catering, please mention your event date, number of guests, and any dietary requirements in your message. We will get back to you within 24 hours.</p>
                </div>
              )}

              {/* Status */}
              {submitStatus === 'success' && (
                <div className="flex items-center gap-3 p-4 bg-[#fdf9ec] border border-green-100 text-[#C8952A] rounded-2xl text-sm">
                  <div className="w-8 h-8 rounded-full bg-[#fdf9ec] flex items-center justify-center flex-shrink-0">
                    <i className="ri-check-line" />
                  </div>
                  Message sent! We will get back to you soon.
                </div>
              )}
              {submitStatus === 'error' && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line" />
                  </div>
                  Something went wrong. Please try again or call us directly.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || verifying}
                className="group inline-flex items-center gap-2.5 px-9 py-4 bg-[#111111] hover:bg-[#111111] text-white rounded-full font-bold text-[14px] transition-all duration-300 hover:shadow-[0_8px_25px_rgba(200,149,42,0.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting || verifying
                  ? (verifying ? 'Verifying…' : 'Sending…')
                  : <><span>Send Message</span><i className="ri-send-plane-fill transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></>
                }
              </button>
            </form>
          </div>

          {/* ── Right: Info ── */}
          <div className="lg:col-span-5 space-y-6">

            {/* Contact card */}
            <div id="location" className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)]">
              <h3 className="font-black text-lg text-gray-900 mb-6">{siteName}</h3>
              <div className="space-y-5">
                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#fdf9ec] flex items-center justify-center flex-shrink-0 border border-[#f5de8f]">
                    <i className="ri-map-pin-line text-lg text-[#C8952A]" />
                  </div>
                  <div className="pt-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-0.5">Location</p>
                    <p className="text-gray-700 font-medium text-[14px]">{contactAddress}</p>
                  </div>
                </div>
                {/* Phone */}
                {phoneLines.length > 0 && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#fdf9ec] flex items-center justify-center flex-shrink-0 border border-[#f5de8f]">
                      <i className="ri-phone-line text-lg text-[#C8952A]" />
                    </div>
                    <div className="pt-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-1">Phone</p>
                      {phoneLines.map((line: string, i: number) => (
                        <a key={i} href={`tel:${line.replace(/\s/g,'')}`} className="block text-gray-700 font-medium text-[14px] hover:text-[#C8952A] transition-colors">{line}</a>
                      ))}
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold px-3 py-1 rounded-full bg-[#fdf9ec] text-[#C8952A] hover:bg-[#fdf9ec] transition-colors">
                          <i className="ri-whatsapp-fill text-sm" /> Chat on WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {/* Social */}
                {(tiktokMain || instagram) && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#fdf9ec] flex items-center justify-center flex-shrink-0 border border-[#f5de8f]">
                      <i className="ri-share-line text-lg text-[#C8952A]" />
                    </div>
                    <div className="pt-1.5 flex flex-wrap gap-2">
                      {tiktokMain && <a href={tiktokMain} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"><i className="ri-tiktok-fill" />TikTok</a>}
                      {tiktokJoy  && <a href={tiktokJoy}  target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"><i className="ri-tiktok-fill" />TikTok 2</a>}
                      {instagram  && <a href={instagram}  target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"><i className="ri-instagram-line" />Instagram</a>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hours card */}
            <div id="hours" className="bg-[#0d0d0d] rounded-3xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <i className="ri-time-line text-lg text-[#e8b428]" />
                </div>
                <h3 className="font-black text-lg">Opening Hours</h3>
              </div>
              <div className="space-y-3">
                {HOURS.map(h => (
                  <div key={h.day} className="flex items-center justify-between text-[13.5px]">
                    <span className="text-white/60 font-medium">{h.day}</span>
                    <span className="font-bold text-white">{h.time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-2 text-[12px] text-white/50">
                <i className="ri-map-pin-line text-[#C8952A]" />
                Cornerstone, NE Calgary
              </div>
            </div>

            {/* FAQs */}
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-gray-400 px-1 mb-3">Quick Answers</p>
              {FAQS.map((faq, idx) => (
                <div key={idx} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-colors">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full px-6 py-4 font-semibold text-gray-800 text-left flex justify-between items-center gap-4 text-[14px]"
                  >
                    <span>{faq.q}</span>
                    <span className={`w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}>
                      <i className="ri-arrow-down-s-line text-gray-400 text-lg" />
                    </span>
                  </button>
                  {openFaq === idx && (
                    <div className="px-6 pb-5 text-gray-500 text-[13.5px] leading-relaxed font-light border-t border-gray-50 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}