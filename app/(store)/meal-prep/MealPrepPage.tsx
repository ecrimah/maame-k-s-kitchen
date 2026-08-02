'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHero from '@/components/PageHero';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string;
  meals_per_week: number;
  price_cents: number;
  cancel_notice_days: number;
  delivery_day: string;
};

export default function MealPrepPage() {
  usePageTitle('Weekly Meal Prep');
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [hasActiveSub, setHasActiveSub] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);

      if (s) {
        const { data: sub } = await supabase
          .from('meal_prep_subscriptions')
          .select('id, status')
          .eq('user_id', s.user.id)
          .in('status', ['active', 'trialing', 'past_due'])
          .maybeSingle();
        setHasActiveSub(!!sub);
      }

      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('status', 'active')
        .order('sort_order');

      setPlans(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      router.push('/auth/login?redirect=/meal-prep');
      return;
    }

    setSubscribing(planId);
    try {
      const res = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId, deliveryMethod: 'pickup' }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        alert(json.message || 'Could not start checkout');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  const fmt = (cents: number) => `CA$${(cents / 100).toFixed(2)}`;

  return (
    <main className="min-h-screen bg-white">
      <PageHero
        title="Weekly Meal Prep"
        subtitle="Authentic Ghanaian meals, prepped fresh and delivered every Saturday in Calgary."
        backgroundImage="/meal_prep_hero.webp"
        badge="Subscribe & Save Time"
      />

      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        {canceled && (
          <div className="mb-8 p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm">
            Checkout was cancelled. You can subscribe whenever you are ready.
          </div>
        )}

        {hasActiveSub && (
          <div className="mb-10 p-5 rounded-2xl bg-[#fdf9ec] border border-[#e8c87a] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-[#6b5018]">You have an active subscription</p>
              <p className="text-sm text-[#8a6830] mt-1">Choose this week&apos;s meals and manage billing in your account.</p>
            </div>
            <Link
              href="/account?tab=meal-prep"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-black transition-colors"
            >
              Manage Subscription
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            { icon: 'ri-calendar-check-line', title: 'Pick Weekly', text: 'Every week we publish a fresh menu. Subscribers choose their meals before the deadline.' },
            { icon: 'ri-bank-card-line', title: 'Auto-Pay', text: 'Your card is charged automatically each week — no checkout every time.' },
            { icon: 'ri-close-circle-line', title: 'Cancel Anytime', text: 'Cancel with at least 3 days notice before your next Saturday delivery. Late cancels include one more week.' },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
              <i className={`${item.icon} text-2xl text-[#C8952A] mb-3 block`}></i>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-serif font-medium text-gray-900 mb-8 text-center">Choose Your Plan</h2>

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-gray-200 max-w-lg mx-auto">
            <p className="text-gray-600">Weekly meal-prep plans are coming soon. Check back shortly.</p>
          </div>
        ) : (
          <div className={`grid gap-6 ${plans.length === 1 ? 'max-w-md mx-auto' : plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
            {plans.map((plan, i) => (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 ${i === 1 ? 'border-[#C8952A] shadow-lg ring-1 ring-[#C8952A]/20' : 'border-gray-200'}`}
              >
                {plans.length >= 3 && i === 1 && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#C8952A] text-white text-[10px] font-black uppercase tracking-widest">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-2 mb-6 flex-1">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gray-900">{fmt(plan.price_cents)}</span>
                  <span className="text-gray-500 text-sm"> / week</span>
                  <p className="text-xs text-gray-400 mt-1">{plan.meals_per_week} meals · Saturday delivery</p>
                </div>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!!subscribing || hasActiveSub}
                  className="w-full py-3.5 rounded-xl bg-[#111111] text-white font-semibold text-sm hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hasActiveSub ? 'Already Subscribed' : subscribing === plan.id ? 'Redirecting...' : 'Subscribe Now'}
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="mt-16 p-8 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-600 leading-relaxed max-w-3xl mx-auto">
          <h3 className="font-bold text-gray-900 mb-3">How billing & cancellation work</h3>
          <ul className="space-y-2 list-disc pl-5">
            <li>You are charged automatically each week via Stripe.</li>
            <li>Choose your meals from the weekly menu before Wednesday 11:59 PM (3 days before Saturday delivery).</li>
            <li>Cancel anytime from your account. If you cancel at least 3 days before delivery, you will not be charged for the upcoming week.</li>
            <li>If you cancel after the deadline, one final weekly charge applies and your subscription ends after that delivery.</li>
            <li>Update your payment method anytime via the billing portal in your account.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
