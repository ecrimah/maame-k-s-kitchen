'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutSteps from '@/components/CheckoutSteps';
import OrderSummary from '@/components/OrderSummary';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { formatPreorderNotice } from '@/lib/product-availability';
import {
  calculateCouponDiscount,
  loadAppliedCouponFromSession,
  saveAppliedCouponToSession,
  toCartCoupon,
  type CartCoupon,
} from '@/lib/coupons';

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'guest' | 'account'>('guest');
  const [saveAddress, setSaveAddress] = useState(false);
  const [savePayment, setSavePayment] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { getToken, verifying } = useRecaptcha();

  const [shippingData, setShippingData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: ''
  });

  const CANADA_CITIES: Record<string, string[]> = {
    'Alberta': ['Airdrie','Banff','Beaumont','Brooks','Calgary','Camrose','Canmore','Chestermere','Cochrane','Cold Lake','Crossfield','Drumheller','Edmonton','Fort McMurray','Fort Saskatchewan','Grande Prairie','High River','Lacombe','Leduc','Lethbridge','Lloydminster','Medicine Hat','Morinville','Okotoks','Olds','Peace River','Ponoka','Red Deer','Sherwood Park','Slave Lake','Spruce Grove','St. Albert','Stony Plain','Strathmore','Sylvan Lake','Taber','Wetaskiwin'],
    'British Columbia': ['Abbotsford','Armstrong','Burnaby','Campbell River','Castlegar','Chilliwack','Colwood','Coquitlam','Courtenay','Cranbrook','Dawson Creek','Delta','Duncan','Fort St. John','Kamloops','Kelowna','Kimberley','Langley','Langford','Maple Ridge','Merritt','Mission','Nanaimo','Nelson','New Westminster','North Vancouver','Parksville','Penticton','Port Alberni','Port Coquitlam','Port Moody','Prince George','Prince Rupert','Quesnel','Richmond','Salmon Arm','Saanich','Surrey','Terrace','Trail','Vancouver','Vernon','Victoria','West Kelowna','White Rock','Williams Lake'],
    'Manitoba': ['Altona','Beausejour','Brandon','Carman','Dauphin','Flin Flon','Gimli','Morden','Neepawa','Portage la Prairie','Selkirk','Steinbach','The Pas','Thompson','Winkler','Winnipeg'],
    'New Brunswick': ['Bathurst','Campbellton','Dieppe','Edmundston','Florenceville-Bristol','Fredericton','Grand Falls','Miramichi','Moncton','Oromocto','Quispamsis','Riverview','Rothesay','Sackville','Saint John','Shediac','Sussex','Woodstock'],
    'Newfoundland and Labrador': ['Carbonear','Channel-Port aux Basques','Clarenville','Corner Brook','Gander','Grand Falls-Windsor','Happy Valley-Goose Bay','Labrador City','Marystown','Mount Pearl','Paradise','Placentia','St. Johns','Stephenville','Wabush'],
    'Northwest Territories': ['Behchoko','Fort Providence','Fort Simpson','Fort Smith','Hay River','Inuvik','Norman Wells','Yellowknife'],
    'Nova Scotia': ['Amherst','Antigonish','Berwick','Bridgewater','Dartmouth','Digby','Glace Bay','Halifax','Kentville','New Glasgow','Pictou','Sydney','Truro','Windsor','Wolfville','Yarmouth'],
    'Nunavut': ['Arviat','Baker Lake','Cambridge Bay','Gjoa Haven','Igloolik','Iqaluit','Rankin Inlet','Repulse Bay'],
    'Ontario': ['Ajax','Aurora','Barrie','Belleville','Brampton','Brantford','Brockville','Burlington','Cambridge','Chatham','Cornwall','Dryden','Guelph','Hamilton','Kingston','Kitchener','London','Markham','Mississauga','Niagara Falls','North Bay','Oakville','Oshawa','Ottawa','Owen Sound','Peterborough','Pickering','Richmond Hill','Sarnia','Sault Ste. Marie','Simcoe','St. Catharines','Sudbury','Thunder Bay','Timmins','Toronto','Vaughan','Waterloo','Whitby','Windsor','Woodstock'],
    'Prince Edward Island': ['Charlottetown','Cornwall','Kensington','Montague','Souris','Stratford','Summerside'],
    'Quebec': ['Blainville','Brossard','Chicoutimi','Drummondville','Gatineau','Granby','Laval','Levis','Longueuil','Montreal','Quebec City','Repentigny','Rimouski','Rouyn-Noranda','Saint-Hyacinthe','Saint-Jean-sur-Richelieu','Saint-Jerome','Saguenay','Sherbrooke','Terrebonne','Trois-Rivieres','Val-d-Or'],
    'Saskatchewan': ['Estevan','Humboldt','Kindersley','Lloydminster','Meadow Lake','Melfort','Melville','Moose Jaw','North Battleford','Prince Albert','Regina','Saskatoon','Swift Current','Weyburn','Yorkton'],
    'Yukon': ['Carmacks','Dawson City','Haines Junction','Mayo','Watson Lake','Whitehorse'],
  };
  const CANADA_PROVINCES = Object.keys(CANADA_CITIES).sort();

  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [errors, setErrors] = useState<any>({});
  const [appliedCoupon, setAppliedCoupon] = useState<CartCoupon | null>(null);



  // Check auth and cart
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setCheckoutType('account'); // Auto-select account checkout if logged in
        // Pre-fill email if available
        setShippingData(prev => ({ ...prev, email: session.user.email || '' }));
      }
    }
    checkUser();

    // Small delay to ensure cart load
    const timer = setTimeout(() => {
      if (cart.length === 0 && !isLoading) {
        // router.push('/cart'); // Optional: redirect if empty
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, router, isLoading]);

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    const stored = loadAppliedCouponFromSession();
    if (stored) setAppliedCoupon(toCartCoupon(stored));
  }, []);

  // Calculate Totals
  const subtotal = cartSubtotal;
  // Doorstep delivery cost is quoted separately (admin contacts the customer),
  // so nothing is added to the checkout total for either option.
  const deliveryFee = 0;
  const tax = 0; // No Tax
  const couponDiscount = appliedCoupon
    ? calculateCouponDiscount(subtotal, appliedCoupon, deliveryFee)
    : 0;
  const effectiveShipping = appliedCoupon?.isFreeShipping ? 0 : deliveryFee;
  const total = subtotal - couponDiscount + effectiveShipping + tax;

  const preorderCartItems = cart.filter((item) => item.preorder);
  const maxPreorderHours = preorderCartItems.length
    ? Math.max(...preorderCartItems.map((item) => item.preorderLeadHours || 24))
    : 0;
  const hasSaturdayOnly = cart.some((item) => item.saturdayOnly);
  const preorderNotice =
    preorderCartItems.length > 0 || hasSaturdayOnly
      ? [
          preorderCartItems.length > 0
            ? `${preorderCartItems.length} dish${preorderCartItems.length > 1 ? 'es' : ''} require advance notice (up to ${formatPreorderNotice(maxPreorderHours)}).`
            : null,
          hasSaturdayOnly ? 'Some items are Saturday-menu only and will be scheduled accordingly.' : null,
        ]
          .filter(Boolean)
          .join(' ')
      : undefined;

  const validateShipping = () => {
    const newErrors: any = {};
    if (!shippingData.firstName) newErrors.firstName = 'First name is required';
    if (!shippingData.lastName) newErrors.lastName = 'Last name is required';
    if (!shippingData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(shippingData.email)) newErrors.email = 'Invalid email';
    if (!shippingData.phone) newErrors.phone = 'Phone is required';
    if (deliveryMethod === 'doorstep' && !shippingData.address) newErrors.address = 'Delivery address is required';
    if (deliveryMethod === 'doorstep' && !shippingData.city) newErrors.city = 'City is required';
    if (deliveryMethod === 'doorstep' && !shippingData.region) newErrors.region = 'Province is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinueToDelivery = () => {
    if (validateShipping()) {
      setCurrentStep(2);
    }
  };

  const handleContinueToPayment = async () => {
    // Proceed directly to Stripe checkout from step 2
    await handlePlaceOrder();
  };



  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setIsLoading(true);

    // reCAPTCHA verification
    const isHuman = await getToken('checkout');
    if (!isHuman) {
      alert('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      // Generate tracking number: SLI-XXXXXX (6-char alphanumeric)
      const trackingId = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const trackingNumber = `SLI-${trackingId}`;

      // 1. Create Order
      const addressJson = {
        firstName: shippingData.firstName,
        lastName: shippingData.lastName,
        email: shippingData.email,
        phone: shippingData.phone,
        address: shippingData.address,
        city: shippingData.city,
        region: shippingData.region,
        country: 'Canada',
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          user_id: user?.id || null, // Capture user_id if logged in
          email: shippingData.email,
          phone: shippingData.phone,
          status: 'pending',
          payment_status: 'pending',
          currency: 'CAD',
          subtotal: subtotal,
          tax_total: tax,
          shipping_total: effectiveShipping,
          discount_total: couponDiscount,
          total: total,
          shipping_method: deliveryMethod,
          delivery_type: deliveryMethod === 'doorstep' ? 'delivery' : 'pickup',
          payment_method: paymentMethod,
          shipping_address: addressJson,
          billing_address: addressJson,
          notes: orderNotes,
          metadata: {
            guest_checkout: !user,
            first_name: shippingData.firstName,
            last_name: shippingData.lastName,
            tracking_number: trackingNumber,
            delivery_method: deliveryMethod,
            ...(preorderCartItems.length > 0 && {
              preorder_items: preorderCartItems.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                lead_hours: item.preorderLeadHours || 24,
                saturday_only: !!item.saturdayOnly,
              })),
              max_preorder_lead_hours: maxPreorderHours,
            }),
            ...(hasSaturdayOnly && { has_saturday_menu_items: true }),
            ...(appliedCoupon && {
              coupon_id: appliedCoupon.id,
              coupon_code: appliedCoupon.code,
              coupon_discount: couponDiscount,
            }),
          }
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Items (with UUID validation)
      // Helper to check if string is a valid UUID
      const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      // Build order items, resolving slugs to UUIDs if needed
      const orderItems = [];
      
      // Batch-fetch product metadata (for preorder_shipping etc.)
      const productIds = cart.map(item => item.id).filter(id => isValidUUID(id));
      const { data: productsData } = productIds.length > 0
        ? await supabase.from('products').select('id, metadata').in('id', productIds)
        : { data: [] };
      const productMetaMap = new Map((productsData || []).map((p: any) => [p.id, p.metadata]));
      
      for (const item of cart) {
        let productId = item.id;
        
        // If id is not a valid UUID, it might be a slug - try to resolve it
        if (!isValidUUID(productId)) {
          const { data: product } = await supabase
            .from('products')
            .select('id, metadata')
            .or(`slug.eq.${productId},id.eq.${productId}`)
            .single();
          
          if (product) {
            productId = product.id;
            productMetaMap.set(product.id, product.metadata);
          } else {
            throw new Error(`Product not found: ${item.name}. Please remove it from your cart and try again.`);
          }
        }
        
        const prodMeta = productMetaMap.get(productId);
        
        orderItems.push({
          order_id: order.id,
          product_id: productId,
          product_name: item.name,
          variant_name: item.variant,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          metadata: {
            image: item.image,
            slug: item.slug,
            preorder_shipping: prodMeta?.preorder_shipping || null
          }
        });
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Note: Stock reduction happens in mark_order_paid when payment is confirmed

      // 3. Upsert Customer Record (for both guest and registered users)
      const fullName = `${shippingData.firstName} ${shippingData.lastName}`.trim();
      await supabase.rpc('upsert_customer_from_order', {
        p_email: shippingData.email,
        p_phone: shippingData.phone,
        p_full_name: fullName,
        p_first_name: shippingData.firstName,
        p_last_name: shippingData.lastName,
        p_user_id: user?.id || null,
        p_address: shippingData
      });

      // 4. Handle Payment Redirects or Completion
      if (paymentMethod === 'stripe') {
        try {
          const paymentRes = await fetch('/api/payment/stripe/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderNumber,
            })
          });

          const paymentResult = await paymentRes.json();

          if (!paymentResult.success) {
            throw new Error(paymentResult.message || 'Payment initialization failed');
          }

          saveAppliedCouponToSession(null);
          clearCart();
          window.location.href = paymentResult.url;
          return;
        } catch (paymentErr: unknown) {
          const message = paymentErr instanceof Error ? paymentErr.message : 'Payment initialization failed';
          console.error('Payment Error:', paymentErr);
          alert('Failed to initialize payment: ' + message);
          setIsLoading(false);
          return;
        }
      }

      // 5. Redeem coupon (non-Stripe — Stripe redeems on payment confirmation)
      if (appliedCoupon) {
        fetch('/api/coupons/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ couponId: appliedCoupon.id, orderNumber }),
        }).catch((err) => console.error('Coupon redeem error:', err));
        saveAppliedCouponToSession(null);
      }

      // 6. Send Notifications (For COD or others)
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_created',
          payload: order
        })
      }).catch(err => console.error('Notification trigger error:', err));

      // 7. Clear Cart & Redirect (For COD)
      clearCart();
      router.push(`/order-success?order=${orderNumber}`);

    } catch (err: any) {
      console.error('Checkout error:', err);
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (cart.length === 0 && !isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 py-20">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <i className="ri-shopping-cart-line text-4xl text-gray-300"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Add some items to start the checkout process.</p>
          <Link href="/menu" className="inline-block bg-[#111111] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#111111] transition-colors">
            Return to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/cart" className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Cart
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        {currentStep === 1 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Checkout As</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => !user && setCheckoutType('guest')}
                className={`p-6 rounded-xl border-2 transition-all text-left cursor-pointer ${checkoutType === 'guest'
                  ? 'border-[#C8952A] bg-[#fdf9ec]'
                  : 'border-gray-200 hover:border-gray-300'
                  } ${user ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!!user}
              >
                <div className="flex items-center justify-between mb-3">
                  <i className="ri-user-line text-3xl text-[#C8952A]"></i>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checkoutType === 'guest' ? 'border-[#C8952A] bg-[#111111]' : 'border-gray-300'
                    }`}>
                    {checkoutType === 'guest' && <i className="ri-check-line text-white text-sm"></i>}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Guest Checkout</h3>
                <p className="text-sm text-gray-600">Quick checkout without creating an account</p>
                {user && <p className="text-xs text-[#C8952A] mt-2">You are logged in</p>}
              </button>

              <button
                onClick={() => setCheckoutType('account')}
                className={`p-6 rounded-xl border-2 transition-all text-left cursor-pointer ${checkoutType === 'account'
                  ? 'border-[#C8952A] bg-[#fdf9ec]'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <i className="ri-account-circle-line text-3xl text-[#C8952A]"></i>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checkoutType === 'account' ? 'border-[#C8952A] bg-[#111111]' : 'border-gray-300'
                    }`}>
                    {checkoutType === 'account' && <i className="ri-check-line text-white text-sm"></i>}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{user ? 'My Account' : 'Create Account'}</h3>
                <p className="text-sm text-gray-600">
                  {user ? `Logged in as ${user.email}` : 'Save info, track orders & earn loyalty points'}
                </p>
              </button>
            </div>
          </div>
        )}

        <CheckoutSteps currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            {currentStep === 1 && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Your Details</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={shippingData.firstName}
                          onChange={(e) => setShippingData({ ...shippingData, firstName: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] ${errors.firstName ? 'border-[#C8952A]' : 'border-gray-300'
                            }`}
                          placeholder="John"
                        />
                        {errors.firstName && <p className="text-sm text-[#C8952A] mt-1">{errors.firstName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={shippingData.lastName}
                          onChange={(e) => setShippingData({ ...shippingData, lastName: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] ${errors.lastName ? 'border-[#C8952A]' : 'border-gray-300'
                            }`}
                          placeholder="Doe"
                        />
                        {errors.lastName && <p className="text-sm text-[#C8952A] mt-1">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={shippingData.email}
                        readOnly={!!user} // Make read-only if logged in (optional, but safer)
                        onChange={(e) => setShippingData({ ...shippingData, email: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] ${errors.email ? 'border-[#C8952A]' : 'border-gray-300'
                          } ${user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="you@example.com"
                      />
                      {errors.email && <p className="text-sm text-[#C8952A] mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={shippingData.phone}
                        onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] ${errors.phone ? 'border-[#C8952A]' : 'border-gray-300'
                          }`}
                        placeholder="+1 XXX XXX XXXX"
                      />
                      {errors.phone && <p className="text-sm text-[#C8952A] mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={shippingData.address}
                        onChange={(e) => setShippingData({ ...shippingData, address: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] ${errors.address ? 'border-[#C8952A]' : 'border-gray-300'
                          }`}
                        placeholder="House number and street name"
                      />
                      {errors.address && <p className="text-sm text-[#C8952A] mt-1">{errors.address}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Province *
                        </label>
                        <select
                          value={shippingData.region}
                          onChange={(e) => setShippingData({ ...shippingData, region: e.target.value, city: '' })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] bg-white ${errors.region ? 'border-[#C8952A]' : 'border-gray-300'}`}
                        >
                          <option value="">Select Province</option>
                          {CANADA_PROVINCES.map((province) => (
                            <option key={province} value={province}>{province}</option>
                          ))}
                        </select>
                        {errors.region && <p className="text-sm text-[#C8952A] mt-1">{errors.region}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          City *
                        </label>
                        <select
                          value={shippingData.city}
                          onChange={(e) => setShippingData({ ...shippingData, city: e.target.value })}
                          disabled={!shippingData.region}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] bg-white ${errors.city ? 'border-[#C8952A]' : 'border-gray-300'} ${!shippingData.region ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="">{shippingData.region ? 'Select City' : 'Select province first'}</option>
                          {(CANADA_CITIES[shippingData.region] || []).map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                        {errors.city && <p className="text-sm text-[#C8952A] mt-1">{errors.city}</p>}
                      </div>
                    </div>

                    {checkoutType === 'account' && (
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                          className="w-5 h-5 text-[#C8952A] rounded border-gray-300 focus:ring-[#C8952A]"
                        />
                        <span className="text-sm text-gray-700">Save this address for future orders</span>
                      </label>
                    )}
                  </div>

                  <button
                    onClick={handleContinueToDelivery}
                    className="w-full mt-6 bg-[#111111] hover:bg-[#111111] text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Continue to Delivery
                  </button>
                </div>


              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Method</h2>
                  <div className="space-y-4">
                    <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-[#C8952A] bg-[#fdf9ec]' : 'border-gray-300 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center space-x-4">
                        <input
                          type="radio"
                          name="delivery"
                          value="pickup"
                          checked={deliveryMethod === 'pickup'}
                          onChange={(e) => setDeliveryMethod(e.target.value)}
                          className="w-5 h-5 text-[#C8952A]"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">Store Pickup</p>
                          <p className="text-sm text-gray-600">Pick up from our store — Ready in 24 hours</p>
                        </div>
                      </div>
                      <p className="font-bold text-[#C8952A]">FREE</p>
                    </label>

                    <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'doorstep' ? 'border-[#C8952A] bg-[#fdf9ec]' : 'border-gray-300 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center space-x-4">
                        <input
                          type="radio"
                          name="delivery"
                          value="doorstep"
                          checked={deliveryMethod === 'doorstep'}
                          onChange={(e) => setDeliveryMethod(e.target.value)}
                          className="w-5 h-5 text-[#C8952A]"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">Doorstep Delivery</p>
                          <p className="text-sm text-gray-600">We will contact you with the delivery cost</p>
                        </div>
                      </div>
                      <p className="font-semibold text-[#C8952A] text-sm">At a Cost</p>
                    </label>

                    {/* Additional delivery options can be added here.
                        Customize zones, fees, and labels for the regions you ship to. */}
                  </div>

                  <div className="flex flex-col-reverse md:flex-row gap-4 mt-6">
                    <button
                      onClick={() => setCurrentStep(1)}
                      disabled={isLoading}
                      className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinueToPayment}
                      disabled={isLoading}
                      className="flex-1 bg-[#111111] hover:bg-[#111111] text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-70 flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        'Pay Securely with Stripe'
                      )}
                    </button>
                  </div>
                </div>


              </>
            )}

            {/* Step 3 removed - payment now initiates directly from step 2 */}
          </div>

          <div className="lg:col-span-1">
            <OrderSummary
              items={cart}
              subtotal={subtotal}
              shipping={effectiveShipping}
              tax={tax}
              total={total}
              preorderNotice={preorderNotice}
              couponCode={appliedCoupon?.code}
              discount={couponDiscount}
            />
          </div>
        </div>
      </div>
    </main>
  );
}



