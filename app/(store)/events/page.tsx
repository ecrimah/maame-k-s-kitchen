'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import PageHero from '@/components/PageHero';
import { embedVideoUrl } from '@/lib/video-embed';

type KitchenEvent = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: string;
  is_upcoming: boolean;
  event_date: string | null;
  end_date: string | null;
  location: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  video_urls: string[];
};

function EventCard({ event, featured }: { event: KitchenEvent; featured?: boolean }) {
  const embed = event.video_urls?.[0] ? embedVideoUrl(event.video_urls[0]) : null;
  const dateStr = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-CA', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Edmonton',
      })
    : null;

  return (
    <article className={`bg-white rounded-2xl border-2 overflow-hidden ${featured ? 'border-[#C8952A] shadow-lg' : 'border-gray-200'}`}>
      {event.cover_image_url && (
        <div className="relative aspect-[16/9] bg-gray-100">
          <Image src={event.cover_image_url} alt={event.title} fill className="object-cover" unoptimized />
        </div>
      )}
      {embed && (
        <div className="aspect-video bg-black">
          {embed.includes('youtube') || embed.includes('vimeo') ? (
            <iframe src={embed} title={event.title} className="w-full h-full" allowFullScreen />
          ) : (
            <video src={embed} controls className="w-full h-full" />
          )}
        </div>
      )}
      <div className="p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {event.is_upcoming && (
            <span className="px-2 py-1 text-xs font-bold uppercase tracking-wide bg-[#C8952A] text-white rounded-full">Upcoming</span>
          )}
          <span className="px-2 py-1 text-xs font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 rounded-full">
            {event.event_type === 'chop_bar' || event.event_type === 'food_fest'
              ? 'Chop Bar Experience'
              : event.event_type === 'catering'
                ? 'Catering'
                : 'Event'}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
        {dateStr && <p className="text-sm text-[#C8952A] font-semibold mb-2"><i className="ri-calendar-line mr-1"></i>{dateStr}</p>}
        {event.location && <p className="text-sm text-gray-500 mb-3"><i className="ri-map-pin-line mr-1"></i>{event.location}</p>}
        {event.description && <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{event.description}</p>}
        {event.gallery_urls?.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {event.gallery_urls.slice(0, 6).map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <Image src={url} alt="" fill className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function EventsPage() {
  usePageTitle('Events');
  const [events, setEvents] = useState<KitchenEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('kitchen_events')
          .select('*')
          .eq('status', 'published')
          .order('event_date', { ascending: false, nullsFirst: false });
        if (!error && data) setEvents(data as KitchenEvent[]);
      } catch {
        /* table may not exist until migration runs */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const upcoming = events.filter(e => e.is_upcoming);
  const chopBar = events.filter(e => e.event_type === 'chop_bar' || e.event_type === 'food_fest');
  const catering = events.filter(e => e.event_type === 'catering' && !e.is_upcoming);
  const past = events.filter(e => !e.is_upcoming && e.event_type !== 'catering' && e.event_type !== 'chop_bar' && e.event_type !== 'food_fest');

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <PageHero
        title="Events & Experiences"
        subtitle="The Chop Bar Experience, catering highlights, and community gatherings — dine in, take out, connect."
        backgroundImage="/events_hero.webp"
        badge="Chop Bar & Catering"
      />

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-[#0d0d0d] text-white rounded-2xl p-8 md:p-12 mb-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#C8952A]/20 to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="text-[#e8b428] text-xs font-bold tracking-[0.25em] uppercase">Community food fest</span>
            <h2 className="text-3xl md:text-4xl font-black mt-3 mb-4">The Chop Bar Experience</h2>
            <p className="text-white/70 leading-relaxed mb-6">
              Our signature food fest — dine-in and takeout, Ghanaian flavours, and a welcoming space to meet people, connect, and socialize. Cornerstone, NE Calgary.
            </p>
            <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-[#C8952A] hover:bg-[#b88425] text-white font-bold rounded-lg transition-colors">
              Ask about the next Chop Bar <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16">Loading events...</p>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <i className="ri-calendar-event-line text-5xl text-gray-300 mb-4 block"></i>
            <p className="text-gray-600 mb-2">Event listings coming soon.</p>
            <p className="text-sm text-gray-400">Follow us on Instagram @maame.k_kitchen for announcements.</p>
          </div>
        ) : (
          <div className="space-y-14">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <i className="ri-calendar-schedule-line text-[#C8952A]"></i> Upcoming Events
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {upcoming.map(e => <EventCard key={e.id} event={e} featured />)}
                </div>
              </section>
            )}

            {chopBar.filter(e => !e.is_upcoming).length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Chop Bar Experiences</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {chopBar.filter(e => !e.is_upcoming).map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}

            {catering.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Catering Events</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catering.map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Events</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {past.map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
