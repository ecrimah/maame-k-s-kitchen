/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const urlOrderNumber = searchParams.get('order') || '';
  
  const [orderNumber, setOrderNumber] = useState(urlOrderNumber);
  const [email, setEmail] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-track if order number AND email are in the URL
  const urlEmail = searchParams.get('email') || '';
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (urlOrderNumber && urlEmail) {
      setEmail(urlEmail);
      fetchOrder(urlOrderNumber, urlEmail);
    }
  }, [urlOrderNumber, urlEmail]);

  const fetchOrder = async (orderNum: string, verifyEmail?: string) => {
    const emailToVerify = verifyEmail || email;
    
    // SECURITY: Email is required for order tracking to prevent unauthorized access
    if (!emailToVerify) {
      setError('Please enter your email address to verify your identity.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum, email: emailToVerify }),
      });
      const result = await res.json();

      if (!res.ok || !result.order) {
        setError(result.error || 'Order not found. Please check your order number and try again.');
        setIsTracking(false);
        return;
      }

      setOrder(result.order);
      setIsTracking(true);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orderNumber) {
      setError('Please enter your order number');
      return;
    }

    if (!email) {
      setError('Please enter your email address for verification');
      return;
    }

    fetchOrder(orderNumber, email);
  };

  // Build tracking timeline from real order data
  const getTrackingSteps = () => {
    if (!order) return [];

    const status = order.status || 'pending';
    const paymentStatus = order.payment_status || 'pending';

    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(status);

    const steps = [
      {
        key: 'placed',
        title: 'Order Received',
        description: 'We got your order — thank you!',
        date: new Date(order.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        icon: 'ri-checkbox-circle-line',
        status: 'completed' as const
      },
      {
        key: 'payment',
        title: 'Payment',
        description: paymentStatus === 'paid' ? 'Payment confirmed' : 'Awaiting payment',
        date: paymentStatus === 'paid'
          ? (order.metadata?.payment_verified_at
            ? new Date(order.metadata.payment_verified_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Confirmed')
          : 'Pending',
        icon: 'ri-bank-card-line',
        status: paymentStatus === 'paid' ? 'completed' as const : 'pending' as const
      },
      {
        key: 'processing',
        title: 'Preparing Your Food',
        description: 'Our kitchen is freshly preparing your order',
        date: currentIndex >= 1 ? 'In the kitchen' : 'Pending',
        icon: 'ri-restaurant-line',
        status: currentIndex >= 1 ? 'completed' as const : currentIndex === 0 && paymentStatus === 'paid' ? 'active' as const : 'pending' as const
      },
      {
        key: 'shipped',
        title: 'Ready / Out for Delivery',
        description: 'Your food is packed and on its way',
        date: currentIndex >= 2 ? 'On the way' : 'Pending',
        icon: 'ri-e-bike-line',
        status: currentIndex >= 2 ? 'completed' as const : currentIndex === 1 ? 'active' as const : 'pending' as const
      },
      {
        key: 'delivered',
        title: 'Delivered',
        description: 'Enjoy your meal!',
        date: currentIndex >= 3 ? 'Delivered' : 'Pending',
        icon: 'ri-home-smile-line',
        status: currentIndex >= 3 ? 'completed' as const : currentIndex === 2 ? 'active' as const : 'pending' as const
      }
    ];

    return steps;
  };

  const getStatusBadge = () => {
    if (!order) return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    
    const statusMap: Record<string, { label: string; color: string }> = {
      'pending': { label: 'Order Received', color: 'bg-[#fdf9ec] text-[#a07020]' },
      'processing': { label: 'Preparing', color: 'bg-[#fdf9ec] text-[#a07020]' },
      'shipped': { label: 'Out for Delivery', color: 'bg-[#fdf9ec] text-[#a07020]' },
      'delivered': { label: 'Delivered', color: 'bg-[#fdf9ec] text-[#a07020]' },
      'cancelled': { label: 'Cancelled', color: 'bg-[#fdf9ec] text-[#a07020]' }
    };

    return statusMap[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
  };

  // Search form
  if (!isTracking || !order) {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Track Your Order</h1>
            <p className="text-gray-600">Enter your order number to see your live order status</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <form onSubmit={handleTrack} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Order Number
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                  placeholder="e.g. ORD-2024-156"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address <span className="text-[#C8952A] font-normal">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="p-4 bg-[#fdf9ec] border border-[#e8c87a] rounded-lg">
                  <p className="text-sm text-[#C8952A]">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#111111] hover:bg-[#111111] text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Searching...
                  </span>
                ) : 'Track Order'}
              </button>
            </form>

            <div className="mt-8 p-4 bg-[#fdf9ec] border border-[#e8c87a] rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-xl text-[#C8952A] mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-[#7a5418]">Need Help?</p>
                  <p className="text-sm text-[#C8952A] mt-1">
                    You can find your order number and tracking number in the SMS or email we sent you after your order was confirmed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Order tracking results
  const trackingSteps = getTrackingSteps();
  const statusBadge = getStatusBadge();
  const trackingNumber = order.metadata?.tracking_number || '';
  const shippingAddress = order.shipping_address || {};
  const scheduledDateRaw = order.estimated_delivery_at || (order.metadata?.preferred_date ? order.metadata.preferred_date + 'T12:00:00' : null);
  const scheduledDate = scheduledDateRaw
    ? new Date(scheduledDateRaw).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const isPickup = order.delivery_type === 'pickup' || order.shipping_method === 'pickup';

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button 
            onClick={() => { setIsTracking(false); setOrder(null); setOrderNumber(''); setEmail(''); }}
            className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center whitespace-nowrap cursor-pointer"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Track Another Order
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
              {trackingNumber && (
                <p className="text-gray-600 mt-1">
                  <span className="font-medium">Tracking:</span>{' '}
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">{trackingNumber}</span>
                </p>
              )}
              {scheduledDate ? (
                <p className="text-gray-500 text-sm mt-1">
                  {isPickup ? 'Pickup' : 'Delivery'} scheduled for <span className="font-semibold text-gray-700">{scheduledDate}</span> &middot; Cornerstone, NE Calgary
                </p>
              ) : (
                <p className="text-gray-500 text-sm mt-1">Cornerstone, NE Calgary</p>
              )}
            </div>
            <div className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap ${statusBadge.color}`}>
              {statusBadge.label}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-[#fdf9ec] rounded-full">
                  <i className="ri-map-pin-line text-xl text-[#C8952A]"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Delivery To</p>
                  <p className="font-semibold text-gray-900">
                    {shippingAddress.city || shippingAddress.region || 'Canada'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-[#fdf9ec] rounded-full">
                  <i className="ri-money-cny-circle-line text-xl text-[#C8952A]"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-semibold text-gray-900">CA$ {Number(order.total).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-[#fdf9ec] rounded-full">
                  <i className="ri-box-3-line text-xl text-[#C8952A]"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Items</p>
                  <p className="font-semibold text-gray-900">
                    {order.order_items?.length || 0} Product{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="relative">
            {trackingSteps.map((step, index) => (
              <div key={step.key} className="flex items-start mb-8 last:mb-0">
                <div className="relative flex flex-col items-center mr-6">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-colors ${
                    step.status === 'completed'
                      ? 'bg-[#111111] text-white'
                      : step.status === 'active'
                      ? 'bg-[#fdf9ec] text-[#C8952A] ring-4 ring-[#C8952A]'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    <i className={`${step.icon} text-xl`}></i>
                  </div>
                  {index < trackingSteps.length - 1 && (
                    <div className={`w-0.5 h-16 mt-2 ${
                      step.status === 'completed' ? 'bg-[#111111]' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className={`font-bold text-lg ${
                    step.status === 'pending' ? 'text-gray-500' : 'text-gray-900'
                  }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    step.status === 'pending' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {step.description}
                  </p>
                  <p className={`text-sm mt-1 font-semibold ${
                    step.status === 'pending' ? 'text-gray-400' : 'text-[#C8952A]'
                  }`}>
                    {step.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Order Items</h2>
          <div className="space-y-4">
            {order.order_items?.map((item: any) => (
              <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                  {item.products?.product_images?.[0]?.url || item.metadata?.image ? (
                    <img
                      src={item.products?.product_images?.[0]?.url || item.metadata?.image}
                      alt={item.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="ri-image-line text-2xl text-gray-300"></i>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                  {item.variant_name && (
                    <p className="text-xs text-gray-500">{item.variant_name}</p>
                  )}
                </div>
                <p className="font-bold text-[#C8952A]">CA$ {Number(item.unit_price).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">Need help with your order?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="text-[#C8952A] hover:text-[#7a5418] font-semibold whitespace-nowrap">
              <i className="ri-customer-service-line mr-1"></i>
              Contact Support
            </Link>
            <Link href="/returns" className="text-[#C8952A] hover:text-[#7a5418] font-semibold whitespace-nowrap">
              <i className="ri-arrow-left-right-line mr-1"></i>
              Report an Issue
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C8952A] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </main>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
