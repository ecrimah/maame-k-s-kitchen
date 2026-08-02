'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function PaymentPage() {
  usePageTitle('Complete Payment');
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/pay-info?ref=${encodeURIComponent(orderId)}`);
        const result = await res.json();

        if (!res.ok || !result.order) {
          setError(result.error || 'Order not found. Please check your link and try again.');
          setLoading(false);
          return;
        }

        setOrder(result.order);

        // If already paid, redirect to success page
        if (result.order.payment_status === 'paid') {
          router.push(`/order-success?order=${result.order.order_number}`);
          return;
        }

      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details.');
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, router]);

  const handlePayNow = async () => {
    if (!order) return;

    setProcessing(true);
    setError(null);

    try {
      const paymentRes = await fetch('/api/payment/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.order_number,
        })
      });

      const paymentResult = await paymentRes.json();

      if (!paymentResult.success) {
        throw new Error(paymentResult.message || 'Payment initialization failed');
      }

      // Redirect to Stripe Checkout
      window.location.href = paymentResult.url;

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to initialize payment. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#e8c87a] border-t-blue-700 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 bg-[#fdf9ec] rounded-full flex items-center justify-center">
            <i className="ri-error-warning-line text-4xl text-[#C8952A]"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-[#111111] hover:bg-[#111111] text-white rounded-lg font-semibold transition-colors"
          >
            <i className="ri-home-line mr-2"></i>
            Go to Homepage
          </Link>
        </div>
      </main>
    );
  }

  const shippingAddress = order?.shipping_address || {};
  const customerName = order?.metadata?.first_name || shippingAddress.firstName || 'Customer';

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <span className="text-2xl font-['Pacifico'] text-[#C8952A]">Maame K’s Kitchen</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Payment</h1>
          <p className="text-gray-600 mt-2">Hi {customerName}, your order is waiting for payment.</p>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <span className="text-sm text-gray-500">Order Number</span>
            <span className="font-semibold text-gray-900">{order?.order_number}</span>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">$ {order?.subtotal?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Shipping</span>
              <span className="text-gray-900">$ {order?.shipping_total?.toFixed(2)}</span>
            </div>
            {order?.discount_total > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="text-[#C8952A]">-$ {order?.discount_total?.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-[#C8952A]">$ {order?.total?.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Status */}
        {order?.payment_status === 'pending' && (
          <div className="bg-[#fdf9ec] border border-[#e8c87a] rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <i className="ri-time-line text-xl text-[#C8952A] mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-[#a07020]">Payment Pending</p>
                <p className="text-sm text-[#C8952A] mt-1">
                  Complete your payment to confirm your order.
                </p>
              </div>
            </div>
          </div>
        )}

        {order?.payment_status === 'failed' && (
          <div className="bg-[#fdf9ec] border border-[#e8c87a] rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <i className="ri-error-warning-line text-xl text-[#C8952A] mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-[#a07020]">Payment Failed</p>
                <p className="text-sm text-[#C8952A] mt-1">
                  Your previous payment attempt was unsuccessful. Please try again.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#fdf9ec] border border-[#e8c87a] rounded-lg p-4 mb-6">
            <p className="text-sm text-[#C8952A]">{error}</p>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayNow}
          disabled={processing}
          className="w-full bg-[#111111] hover:bg-[#111111] text-white py-4 rounded-xl font-semibold text-lg transition-colors disabled:opacity-70 flex items-center justify-center cursor-pointer"
        >
          {processing ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <i className="ri-secure-payment-line mr-2"></i>
              Pay $ {order?.total?.toFixed(2)} with Stripe
            </>
          )}
        </button>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center">
            <i className="ri-lock-line mr-1"></i>
            Secure payment powered by Stripe
          </p>
        </div>

        {/* Help Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Having issues? <Link href="/contact" className="text-[#C8952A] hover:underline">Contact Support</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
