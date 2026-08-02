'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import {
  calculateCouponDiscount,
  loadAppliedCouponFromSession,
  saveAppliedCouponToSession,
  toCartCoupon,
  type CartCoupon,
} from '@/lib/coupons';
import CartCountdown from '@/components/CartCountdown';
import AdvancedCouponSystem from '@/components/AdvancedCouponSystem';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function CartPage() {
  usePageTitle('Your Order');
  const { cart: cartItems, removeFromCart, updateQuantity, subtotal, addToCart } = useCart();
  const [appliedCoupon, setAppliedCoupon] = useState<CartCoupon | null>(null);

  useEffect(() => {
    const saved = loadAppliedCouponFromSession();
    if (saved) setAppliedCoupon(toCartCoupon(saved));
  }, []);
  const [savedItems, setSavedItems] = useState<any[]>([]);

  // Function to move item to saved for later (local state only for now)
  const saveForLater = (id: string) => {
    const item = cartItems.find(item => item.id === id);
    if (item) {
      setSavedItems([...savedItems, item]);
      removeFromCart(item.id, item.variant); // Use context's removeFromCart
    }
  };

  const moveToCart = (id: string) => {
    const item = savedItems.find(item => item.id === id);
    if (item) {
      // addToCart expects a CartItem object which already includes quantity
      addToCart(item);
      setSavedItems(savedItems.filter(item => item.id !== id));
    }
  };

  const applyCoupon = (coupon: CartCoupon) => {
    setAppliedCoupon(coupon);
    saveAppliedCouponToSession({
      id: coupon.id,
      code: coupon.code,
      type: coupon.isFreeShipping ? 'free_shipping' : coupon.type === 'percentage' ? 'percentage' : 'fixed_amount',
      discount: coupon.discount,
      maxDiscount: coupon.maxDiscount,
      minPurchase: coupon.minPurchase,
      description: coupon.description,
    });
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    saveAppliedCouponToSession(null);
  };

  // Savings calculation is tricky without originalPrice in Context.
  // Assuming 0 for now unless we update Context.
  const savings = 0;

  const deliveryFee: number = 5;
  const couponDiscount = appliedCoupon
    ? calculateCouponDiscount(subtotal, appliedCoupon, deliveryFee)
    : 0;
  const effectiveDelivery =
    appliedCoupon?.isFreeShipping ? 0 : deliveryFee;
  const total = subtotal - couponDiscount + effectiveDelivery;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero title="Your Order" backgroundImage="/home_hero_3.webp" />
      <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <CartCountdown />
        {/* <FreeShippingBar currentAmount={subtotal} threshold={200} /> */}

        {cartItems.length === 0 && savedItems.length === 0 ? (
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-200 rounded-full">
                <i className="ri-shopping-cart-line text-5xl text-gray-400"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Your order is empty</h2>
              <p className="text-gray-600 mb-8 text-lg">Looks like you haven't added any dishes yet</p>
              <Link href="/menu" className="inline-block bg-[#111111] hover:bg-[#111111] text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap">
                Browse Menu
              </Link>
            </div>
          </section>
        ) : (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Your Order ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</h2>
                      {savings > 0 && (
                        <span className="text-[#0A0F1D] font-semibold">You save ${savings.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="space-y-6">
                      {cartItems.map((item) => (
                        <div key={`${item.id}-${item.variant || ''}`} className="flex flex-col sm:flex-row gap-4 sm:gap-6 pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                          <Link href={`/product/${item.slug || item.id}`} className="relative w-full sm:w-32 h-48 sm:h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                            <Image src={item.image} alt={item.name} fill className="object-cover object-center" sizes="(max-width: 640px) 100vw, 128px" quality={70} />
                          </Link>

                          <div className="flex-1">
                            <div className="flex justify-between mb-2">
                              <Link href={`/product/${item.slug || item.id}`} className="text-lg font-semibold text-gray-900 hover:text-[#C8952A] transition-colors line-clamp-2">
                                {item.name}
                              </Link>
                              <button
                                onClick={() => removeFromCart(item.id, item.variant)}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#C8952A] transition-colors"
                              >
                                <i className="ri-close-line text-xl"></i>
                              </button>
                            </div>

                            <div className="text-sm text-gray-600 mb-3 space-y-1">
                              {item.variant && <p className='text-xs text-gray-500'>Portion: {item.variant}</p>}
                              {/* Stock status assuming always available if in cart for now */}
                              <p className="text-[#C8952A] font-medium text-xs flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C8952A] inline-block"></span>Made fresh to order</p>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="flex items-baseline space-x-3">
                                <span className="text-xl font-bold text-gray-900">CA$`${item.price.toFixed(2)}</span>
                              </div>

                              <div className="flex items-center space-x-4">
                                <div className="flex flex-col">
                                  <div className="flex items-center border-2 border-gray-300 rounded-lg">
                                    <button
                                      onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                                      className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                      title={item.quantity <= (item.moq || 1) ? 'Remove item' : 'Decrease quantity'}
                                    >
                                      {item.quantity <= (item.moq || 1) ? (
                                        <i className="ri-delete-bin-line text-[#C8952A]"></i>
                                      ) : (
                                        <i className="ri-subtract-line"></i>
                                      )}
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || (item.moq || 1), item.variant)}
                                      className="w-12 h-10 text-center border-x-2 border-gray-300 focus:outline-none font-semibold"
                                      min={item.moq || 1}
                                      max={item.maxStock}
                                    />
                                    <button
                                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                                      className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                      <i className="ri-add-line"></i>
                                    </button>
                                  </div>
                                  {(item.moq || 1) > 1 && (
                                    <span className="text-xs text-[#C8952A] mt-1">
                                      Min. order: {item.moq} units
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Saved for later functionality temporarily disabled until fully implemented with Context integration if requested */}
                            {/* Saved for later CTA kept commented out; would use brand color if re-enabled */}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {savedItems.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Saved for Later ({savedItems.length})</h3>
                      <div className="space-y-4">
                        {savedItems.map((item) => (
                          <div key={item.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                            <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                              <Image src={item.image} alt={item.name} fill className="object-cover object-center" sizes="80px" quality={60} />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">{item.name}</p>
                              <p className="text-lg font-bold text-gray-900 mb-2">CA$`${item.price.toFixed(2)}</p>
                              {/* Move to cart disabled for now */}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h3>

                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between text-gray-700">
                        <span>Subtotal</span>
                        <span className="font-semibold">CA$$${subtotal.toFixed(2)}</span>
                      </div>

                      {appliedCoupon && (
                        <div className="flex justify-between text-[#0A0F1D]">
                          <div className="flex items-center space-x-2">
                            <span>Coupon ({appliedCoupon.code})</span>
                          </div>
                          <span className="font-semibold">-${couponDiscount.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-gray-700">
                        <span>Delivery fee</span>
                        <span className="font-semibold">{deliveryFee === 0 ? 'FREE' : `CA$$${deliveryFee.toFixed(2)}`}</span>
                      </div>
                      {deliveryFee > 0 && (
                        <p className="text-xs text-gray-500">Delivery fee calculated at checkout</p>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-6">
                      <div className="flex justify-between text-xl font-bold text-gray-900">
                        <span>Total</span>
                        <span>CA$$${total.toFixed(2)}</span>
                      </div>
                    </div>

                    <AdvancedCouponSystem
                      subtotal={subtotal}
                      onApply={applyCoupon}
                      onRemove={removeCoupon}
                      appliedCoupon={appliedCoupon}
                    />

                    <Link
                      href="/checkout"
                      className="block w-full bg-[#111111] hover:bg-[#111111] text-white py-4 rounded-lg font-semibold text-center transition-colors mt-6 mb-3 whitespace-nowrap"
                    >
                      Proceed to Checkout
                    </Link>

                    <Link
                      href="/menu"
                      className="block w-full text-center text-[#0A0F1D] hover:text-black font-semibold py-2 whitespace-nowrap"
                    >
                      Browse Menu
                    </Link>

                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="ri-shield-check-line text-[#0A0F1D] mr-2"></i>
                        <span>Secure checkout</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="ri-arrow-left-right-line text-[#0A0F1D] mr-2"></i>
                        <span>Issues? Contact us within 2 hours</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="ri-customer-service-line text-[#0A0F1D] mr-2"></i>
                        <span>Same-day delivery across Calgary</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
