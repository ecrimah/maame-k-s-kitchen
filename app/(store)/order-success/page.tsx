/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<
    Array<{ left: number; top: number; delay: number; duration: number; icon: string; color: string }>
  >([]);

  useEffect(() => {
    if (!showConfetti) return;

    const icons = ['heart', 'star', 'gift'];
    const colors = ['blue', 'amber', 'blue'];
    setConfettiPieces(
      Array.from({ length: 50 }, () => ({
        left: Math.random() * 100,
        top: -(Math.random() * 20),
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2,
        icon: icons[Math.floor(Math.random() * icons.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
      }))
    );
  }, [showConfetti]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function fetchOrder() {
      if (!orderNumber) {
        setLoading(false);
        return;
      }

      try {
        const { data: orderData, error } = await supabase
          .from('orders')
          .select(`
                    *,
                    order_items (*)
                `)
          .eq('order_number', orderNumber)
          .single();

        if (error) throw error;
        setOrder(orderData);
        if (orderData.payment_status === 'paid') {
          setShowConfetti(true);
        }

        // If redirected from Stripe and order is still pending, verify payment
        if (sessionId && orderData && orderData.payment_status !== 'paid') {
          verifyPayment(orderNumber, sessionId);
        }
      } catch (err) {
        console.error('Error fetching order:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderNumber, sessionId]);

  // Payment verification — called after Stripe redirects back with session_id
  const verifyPayment = async (orderNum: string, stripeSessionId: string) => {
    setVerifying(true);
    
    // Wait briefly to give the webhook a chance to process first
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: refreshed } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('order_number', orderNum)
      .single();
    
    if (refreshed?.payment_status === 'paid') {
      setOrder(refreshed);
      setShowConfetti(true);
      setVerifying(false);
      return;
    }

    try {
      const res = await fetch('/api/payment/stripe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum, sessionId: stripeSessionId })
      });
      
      const result = await res.json();
      console.log('Payment verification result:', result);
      
      if (result.success && result.payment_status === 'paid') {
        const { data: updated } = await supabase
          .from('orders')
          .select('*, order_items (*)')
          .eq('order_number', orderNum)
          .single();
        if (updated) {
          setOrder(updated);
          setShowConfetti(true);
        }
      }
    } catch (err) {
      console.error('Payment verification failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-[#C8952A] animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Use a fallback or nice error if order not found
  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-error-warning-line text-4xl text-[#C8952A] mb-4 block"></i>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn't locate the order details.</p>
          <Link href="/menu" className="text-[#C8952A] font-semibold hover:underline">
            Return to Shop
          </Link>
        </div>
      </main>
    );
  }

  const isPaid = order.payment_status === 'paid';
  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const scheduledDateRaw = order.estimated_delivery_at || (order.metadata?.preferred_date ? order.metadata.preferred_date + 'T12:00:00' : null);
  const estimatedDelivery = scheduledDateRaw
    ? new Date(scheduledDateRaw).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'We will confirm with you shortly';
  const isPickup = order.delivery_type === 'pickup' || order.shipping_method === 'pickup';
  const pointsEarned = Math.floor(order.total / 10); // Example logic: 1 point per 10 currency units

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-[#0d0d0d]">
      {showConfetti && confettiPieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiPieces.map((piece, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${piece.left}%`,
                top: `${piece.top}%`,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`
              }}
            >
              <i className={`ri-${piece.icon}-fill text-${piece.color}-500 text-xl opacity-70`}></i>
            </div>
          ))}
        </div>
      )}

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {verifying && (
            <div className="mb-6 bg-[#fdf9ec] border border-[#e8c87a] rounded-xl p-4 flex items-center justify-center gap-3">
              <i className="ri-loader-4-line text-xl text-[#C8952A] animate-spin"></i>
              <p className="text-sm font-semibold text-[#7a5418]">Confirming payment…</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center mb-8">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-[#fdf9ec] rounded-full">
              <i className={`${isPaid ? 'ri-checkbox-circle-fill text-[#C8952A]' : verifying ? 'ri-loader-4-line text-[#C8952A] animate-spin' : 'ri-time-line text-[#a07020]'} text-6xl`}></i>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {isPaid ? 'Order Confirmed!' : verifying ? 'Confirming payment…' : 'Payment pending'}
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              {isPaid
                ? "Thank you for your purchase. We're processing your order now."
                : verifying
                  ? 'Please wait while we confirm your payment with Stripe.'
                  : 'Your order is saved, but payment has not been confirmed yet.'}
            </p>

            <div className="bg-[#fdf9ec] rounded-xl p-6 mb-8">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Order Number</p>
                  <p className="text-lg font-bold text-gray-900">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Order Date</p>
                  <p className="text-lg font-bold text-gray-900">{orderDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">{isPickup ? 'Pickup Date' : 'Delivery Date'}</p>
                  <p className="text-lg font-bold text-[#C8952A]">{estimatedDelivery}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href={`/account?tab=orders`}
                className="bg-[#111111] hover:bg-[#111111] text-white px-8 py-4 rounded-lg font-semibold transition-colors inline-flex items-center justify-center whitespace-nowrap"
              >
                <i className="ri-file-list-3-line mr-2"></i>
                View Order
              </Link>
              <Link
                href="/menu"
                className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-4 rounded-lg font-semibold transition-colors inline-flex items-center justify-center whitespace-nowrap"
              >
                <i className="ri-shopping-bag-line mr-2"></i>
                Continue Shopping
              </Link>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-[#0d0d0d] rounded-xl p-6 border-2 border-[#e8c87a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-[#C8952A] rounded-full">
                    <i className="ri-star-fill text-white text-2xl"></i>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-lg">You Earned {pointsEarned} Points!</p>
                    <p className="text-sm text-gray-600">Join our loyalty program to redeem.</p>
                  </div>
                </div>
                <Link
                  href="/auth/signup"
                  className="bg-[#C8952A] hover:bg-[#111111] text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  Join Now
                </Link>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Items</h2>
              <div className="space-y-4">
                {order.order_items.map((item: any) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <img
                        src={item.metadata?.image || '/logo.png'}
                        alt={item.product_name}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 line-clamp-2">{item.product_name}</p>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      {item.variant_name && (
                        <p className="text-xs text-gray-500">{item.variant_name}</p>
                      )}
                      {item.metadata?.preorder_shipping && (
                        <p className="text-xs text-[#C8952A] bg-[#fdf9ec] inline-flex items-center gap-1 px-2 py-0.5 rounded mt-1 border border-[#e8c87a]">
                          <i className="ri-time-line"></i> {item.metadata.preorder_shipping}
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-gray-900">${item.unit_price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Shipping</span>
                  <span>${order.shipping_total.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-xl font-bold text-gray-900 border-t border-gray-200 pt-2">
                  <span>{isPaid ? 'Total Paid' : 'Order Total'}</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Details</h2>
              <div className="space-y-3">
                {order.shipping_address && (
                  <>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Recipient</p>
                      <p className="font-semibold text-gray-900">
                        {order.shipping_address.firstName} {order.shipping_address.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Address</p>
                      <p className="text-gray-900">{order.shipping_address.address}</p>
                      <p className="text-gray-900">{order.shipping_address.city}, {order.shipping_address.region}</p>
                      <p className="text-gray-900">{order.shipping_address.postalCode}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Phone</p>
                      <p className="text-gray-900">{order.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Email</p>
                      <p className="text-gray-900">{order.email}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">What's Next?</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <i className="ri-mail-line text-[#C8952A] mt-1"></i>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Email Confirmation</p>
                      <p className="text-sm text-gray-600">Sent to {order.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <i className="ri-box-3-line text-[#C8952A] mt-1"></i>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Processing</p>
                      <p className="text-sm text-gray-600">We'll pack your order today</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <i className="ri-truck-line text-[#C8952A] mt-1"></i>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Shipping Updates</p>
                      <p className="text-sm text-gray-600">Track via email & SMS</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">Need help with your order?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="text-[#C8952A] hover:text-[#7a5418] font-semibold whitespace-nowrap">
                <i className="ri-customer-service-line mr-1"></i>
                Contact Support
              </Link>
              <Link href="/account?tab=orders" className="text-[#C8952A] hover:text-[#7a5418] font-semibold whitespace-nowrap">
                <i className="ri-question-line mr-1"></i>
                Order Help
              </Link>
              <Link href="/returns" className="text-[#C8952A] hover:text-[#7a5418] font-semibold whitespace-nowrap">
                <i className="ri-arrow-left-right-line mr-1"></i>
                Returns Policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
      `}</style>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#C8952A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
