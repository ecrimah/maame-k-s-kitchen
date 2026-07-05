'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ProductFormProps {
  initialData?: any;
  isEditMode?: boolean;
}

const ALLERGENS = ['Nuts', 'Dairy', 'Eggs', 'Gluten', 'Shellfish', 'Soy', 'Fish', 'Sesame'];

function VideoUrlInput({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = useState('');
  return (
    <div className="flex gap-2">
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://youtube.com/watch?v=... or direct MP4 link"
        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] text-sm"
      />
      <button
        type="button"
        onClick={() => { if (url.trim()) { onAdd(url); setUrl(''); } }}
        className="px-4 py-2 bg-[#111111] text-white rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer"
      >
        Add link
      </button>
    </div>
  );
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('general');
  const [dishName, setDishName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [categoryId, setCategoryId] = useState(initialData?.category_id || '');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [featured, setFeatured] = useState(initialData?.featured || false);
  const [price, setPrice] = useState(initialData?.price?.toString() || '');
  const [comparePrice, setComparePrice] = useState(initialData?.compare_at_price?.toString() || '');
  const [sku, setSku] = useState(initialData?.sku || '');
  const [stock, setStock] = useState(initialData?.quantity?.toString() || '');
  const [lowStockThreshold, setLowStockThreshold] = useState(initialData?.metadata?.low_stock_threshold?.toString() || '10');
  const [isHalal, setIsHalal] = useState(initialData?.is_halal ?? true);
  const [isVegetarian, setIsVegetarian] = useState(initialData?.is_vegetarian ?? false);
  const [isVegan, setIsVegan] = useState(initialData?.is_vegan ?? false);
  const [isGlutenFree, setIsGlutenFree] = useState(initialData?.is_gluten_free ?? false);
  const [spiceLevel, setSpiceLevel] = useState<number>(initialData?.spice_level ?? 0);
  const [prepTime, setPrepTime] = useState(initialData?.prep_time?.toString() || '');
  const [calories, setCalories] = useState(initialData?.calories?.toString() || '');
  type DishAvailability = 'available' | 'unavailable' | 'preorder';
  const getInitialDishAvailability = (): DishAvailability => {
    const isPreorder =
      initialData?.availability_mode === 'preorder' ||
      initialData?.metadata?.availability_mode === 'preorder';
    if (isPreorder) return 'preorder';
    if (initialData?.is_available_today === false) return 'unavailable';
    return 'available';
  };
  const [dishAvailability, setDishAvailability] = useState<DishAvailability>(getInitialDishAvailability);
  const [preorderLeadHours, setPreorderLeadHours] = useState(
    String(initialData?.preorder_lead_hours ?? initialData?.metadata?.preorder_lead_hours ?? 24)
  );
  const [saturdayOnly, setSaturdayOnly] = useState(() => {
    const days: string[] = initialData?.available_days || initialData?.metadata?.available_days || [];
    return days.includes('saturday');
  });
  const [videoUrls, setVideoUrls] = useState<string[]>(
    initialData?.metadata?.videos ||
    (initialData?.product_images || [])
      .filter((i: any) => i.media_type === 'video')
      .map((i: any) => i.url) ||
    []
  );
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [allergens, setAllergens] = useState<string[]>(initialData?.allergens || []);
  const [ingredients, setIngredients] = useState(
    Array.isArray(initialData?.ingredients)
      ? initialData.ingredients.join(', ')
      : (initialData?.ingredients || '')
  );
  const [portions, setPortions] = useState<{ id?: string; name: string; price: string; stock: string; sku: string }[]>(
    initialData?.product_variants?.length
      ? initialData.product_variants.map((v: any) => ({ id: v.id, name: v.option1 || v.name || '', price: v.price?.toString() || '', stock: (v.stock ?? v.quantity ?? 0).toString(), sku: v.sku || '' }))
      : [{ name: 'Regular', price: '', stock: '', sku: '' }]
  );
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.product_images?.sort((a: any, b: any) => a.position - b.position).map((i: any) => i.url) || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [seoTitle, setSeoTitle] = useState(initialData?.seo_title || initialData?.metadata?.seo_title || '');
  const [seoDesc, setSeoDesc] = useState(initialData?.seo_description || initialData?.metadata?.seo_description || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [keywords, setKeywords] = useState(initialData?.metadata?.keywords || '');
  const [focusKeyword, setFocusKeyword] = useState(initialData?.metadata?.focus_keyword || '');
  const [noindex, setNoindex] = useState<boolean>(initialData?.metadata?.noindex ?? false);
  const [offersProtein, setOffersProtein] = useState<boolean>(initialData?.metadata?.offers_protein ?? false);

  useEffect(() => { supabase.from('categories').select('id, name').then(({ data }) => { if (data) setCategories(data); }); }, []);
  useEffect(() => { if (!isEditMode && dishName) setSlug(dishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); }, [dishName, isEditMode]);

  const generateSku = () => `MKK-${Date.now().toString(36).toUpperCase().slice(-4)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  const toggleAllergen = (a: string) => setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const addPortion = () => setPortions(prev => [...prev, { name: '', price: '', stock: '', sku: '' }]);
  const removePortion = (i: number) => setPortions(prev => prev.filter((_, idx) => idx !== i));
  const updatePortion = (i: number, field: string, value: string) => setPortions(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  const applyPortionPresets = () => { const base = parseFloat(price) || 0; setPortions([{ name: 'Regular', price: base.toFixed(2), stock: stock || '50', sku: generateSku() }, { name: 'Large', price: (base * 1.35).toFixed(2), stock: '30', sku: generateSku() }, { name: 'Family', price: (base * 2.5).toFixed(2), stock: '15', sku: generateSku() }]); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImage(true);
    const failed: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `dishes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('products').upload(path, file);
      if (error || !data) {
        failed.push(`${file.name}: ${error?.message || 'upload failed'}`);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      setImageUrls(prev => [...prev, publicUrl]);
    }
    setUploadingImage(false);
    // Reset input so re-selecting the same file triggers a new upload
    e.target.value = '';
    if (failed.length) {
      alert(`Could not upload ${failed.length} image(s):\n\n${failed.join('\n')}`);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingVideo(true);
    const failed: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      if (!['mp4', 'webm', 'mov', 'm4v'].includes(ext)) {
        failed.push(`${file.name}: use MP4, WebM, or MOV`);
        continue;
      }
      const path = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('products').upload(path, file);
      if (error || !data) {
        failed.push(`${file.name}: ${error?.message || 'upload failed'}`);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      setVideoUrls(prev => [...prev, publicUrl]);
    }
    setUploadingVideo(false);
    e.target.value = '';
    if (failed.length) alert(`Could not upload ${failed.length} video(s):\n\n${failed.join('\n')}`);
  };

  const addVideoUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed && !videoUrls.includes(trimmed)) setVideoUrls(prev => [...prev, trimmed]);
  };

  const handleSubmit = async () => {
    if (!dishName.trim()) { alert('Dish name is required'); setActiveTab('general'); return; }
    if (!price) { alert('Price is required'); setActiveTab('pricing'); return; }
    setLoading(true);
    try {
      const ingredientsArray = ingredients
        .split(/[,\n]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      const baseSlug = (slug || dishName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/(^-|-$)/g, '');

      const productData: any = {
        name: dishName.trim(),
        description,
        category_id: categoryId || null,
        price: parseFloat(price),
        compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
        sku: sku || generateSku(),
        quantity: parseInt(stock) || 0,
        status: status.toLowerCase(),
        featured,
        slug: baseSlug,
        is_halal: isHalal,
        is_vegetarian: isVegetarian,
        is_vegan: isVegan,
        is_gluten_free: isGlutenFree,
        spice_level: spiceLevel,
        prep_time: prepTime ? parseInt(prepTime) : null,
        calories: calories ? parseInt(calories) : null,
        is_available_today: dishAvailability !== 'unavailable',
        available_days: saturdayOnly ? ['saturday'] : [],
        allergens,
        ingredients: ingredientsArray,
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        metadata: {
          low_stock_threshold: parseInt(lowStockThreshold) || 10,
          seo_title: seoTitle,
          seo_description: seoDesc,
          keywords,
          focus_keyword: focusKeyword,
          noindex,
          offers_protein: offersProtein,
          availability_mode: dishAvailability === 'preorder' ? 'preorder' : 'standard',
          preorder_lead_hours: dishAvailability === 'preorder' ? parseInt(preorderLeadHours) || 24 : null,
          available_days: saturdayOnly ? ['saturday'] : [],
          videos: videoUrls,
        },
      };

      let productId = initialData?.id;
      let createdNewProduct = false;
      if (isEditMode && productId) {
        const { error } = await supabase.from('products').update(productData).eq('id', productId);
        if (error) throw error;
      } else {
        let attempt = 0;
        let lastError: any = null;
        while (attempt < 5) {
          productData.slug =
            attempt === 0
              ? baseSlug
              : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
          const { data, error } = await supabase
            .from('products')
            .insert(productData)
            .select('id')
            .single();
          if (!error && data) {
            productId = data.id;
            createdNewProduct = true;
            lastError = null;
            break;
          }
          // 23505 = unique_violation. Retry with a fresh slug suffix.
          if (error?.code === '23505' && /slug/i.test(error?.message || '')) {
            attempt++;
            lastError = error;
            continue;
          }
          throw error;
        }
        if (!productId) throw lastError || new Error('Could not generate a unique slug for this dish.');
      }

      try {
        if (isEditMode) await supabase.from('product_variants').delete().eq('product_id', productId);
        const validPortions = portions.filter(p => p.name.trim());
        if (validPortions.length > 0) {
          const { error: variantError } = await supabase
            .from('product_variants')
            .insert(validPortions.map((p, i) => ({
              product_id: productId,
              option1: p.name,
              name: p.name,
              price: parseFloat(p.price) || parseFloat(price),
              quantity: parseInt(p.stock) || 0,
              sku: p.sku || generateSku(),
              metadata: { position: i },
            })));
          if (variantError) throw variantError;
        }

        if (imageUrls.length > 0 || videoUrls.length > 0) {
          if (isEditMode) await supabase.from('product_images').delete().eq('product_id', productId);
          if (imageUrls.length > 0) {
            const { error: imageError } = await supabase.from('product_images').insert(
              imageUrls.map((url, i) => ({
                product_id: productId,
                url,
                position: i,
                alt_text: dishName,
              }))
            );
            if (imageError) throw imageError;
          }
        }
      } catch (childError) {
        // If we just created the parent product but a child insert failed,
        // roll the orphan product back so the admin can retry cleanly.
        if (createdNewProduct && productId) {
          await supabase.from('product_variants').delete().eq('product_id', productId);
          await supabase.from('product_images').delete().eq('product_id', productId);
          await supabase.from('products').delete().eq('id', productId);
        }
        throw childError;
      }

      alert(isEditMode ? 'Dish updated!' : 'Dish added to menu!');
      router.push('/admin/products');
    } catch (err: any) {
      const code = err?.code ? ` (code ${err.code})` : '';
      alert('Error saving dish: ' + (err?.message || 'Please try again.') + code);
    } finally {
      setLoading(false);
    }
  };

  const spiceLabels = ['None', 'Mild', 'Medium', 'Hot'];
  const tabs = [{ id: 'general', label: 'General', icon: 'ri-information-line' }, { id: 'pricing', label: 'Pricing', icon: 'ri-price-tag-3-line' }, { id: 'portions', label: 'Portions', icon: 'ri-bowl-line' }, { id: 'images', label: 'Images', icon: 'ri-image-line' }, { id: 'seo', label: 'SEO', icon: 'ri-search-line' }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/admin/products" className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Dish' : 'Add New Dish'}</h1>
            <p className="text-gray-600 mt-1">{isEditMode ? 'Update dish details and availability' : 'Add a new dish to your menu'}</p>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={loading} className="px-6 py-3 bg-[#111111] hover:bg-[#333] text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 disabled:opacity-60">
          <i className={loading ? 'ri-loader-4-line animate-spin text-xl' : 'ri-save-line text-xl'}></i>
          {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add to Menu'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-2 px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${activeTab === tab.id ? 'border-[#C8952A] text-[#C8952A] bg-[#fdf9ec]' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                <i className={`${tab.icon} text-xl`}></i><span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Dish Name *</label>
                <input type="text" value={dishName} onChange={e => setDishName(e.target.value)} placeholder="e.g. Jollof Rice, Banku & Tilapia" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} placeholder="Describe the dish — ingredients, how it's served, what makes it special..." className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] resize-none" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] cursor-pointer">
                    <option value="">Select category...</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] cursor-pointer">
                    <option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="p-5 border-2 border-gray-200 rounded-xl space-y-5">
                <h3 className="font-bold text-gray-900">Dish Details</h3>
                <div className="grid md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Prep Time (mins)</label>
                    <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="e.g. 20" min="0" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Calories (kcal)</label>
                    <input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="e.g. 450" min="0" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Availability</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: 'available' as const, label: 'Available', icon: 'ri-checkbox-circle-line', active: 'bg-green-50 border-green-400 text-green-700' },
                      { value: 'unavailable' as const, label: 'Unavailable', icon: 'ri-close-circle-line', active: 'bg-gray-100 border-gray-400 text-gray-700' },
                      { value: 'preorder' as const, label: 'Preorder', icon: 'ri-calendar-check-line', active: 'bg-[#fdf9ec] border-[#C8952A] text-[#7a5418]' },
                    ]).map(({ value, label, icon, active }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDishAvailability(value)}
                        className={`py-3 rounded-lg font-semibold border-2 transition-colors cursor-pointer text-sm ${dishAvailability === value ? active : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        <i className={`${icon} mr-1`}></i>{label}
                      </button>
                    ))}
                  </div>
                  {dishAvailability === 'preorder' && (
                    <div className="mt-4 grid md:grid-cols-2 gap-4 p-4 bg-[#fdf9ec] border border-[#e8c87a] rounded-lg">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Minimum Notice (hours)</label>
                        <input
                          type="number"
                          min={1}
                          value={preorderLeadHours}
                          onChange={e => setPreorderLeadHours(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] bg-white"
                        />
                        <p className="text-xs text-gray-600 mt-1">e.g. 24 = at least 24 hours before pickup/delivery</p>
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={saturdayOnly}
                          onChange={e => setSaturdayOnly(e.target.checked)}
                          className="w-5 h-5 accent-[#C8952A] mt-1"
                        />
                        <span className="text-sm text-gray-800">
                          <strong>Saturday menu only</strong> — show this dish on Saturdays (assign category &quot;Saturday Menu&quot; too if you like)
                        </span>
                      </label>
                    </div>
                  )}
                  {dishAvailability === 'available' && (
                    <label className="flex items-center gap-3 cursor-pointer mt-4">
                      <input
                        type="checkbox"
                        checked={saturdayOnly}
                        onChange={e => setSaturdayOnly(e.target.checked)}
                        className="w-5 h-5 accent-[#C8952A]"
                      />
                      <span className="text-sm text-gray-800">
                        <strong>Saturday menu only</strong> — limit to Saturdays only
                      </span>
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Spice Level</label>
                  <div className="flex gap-3">
                    {spiceLabels.map((label, i) => (
                      <button key={i} type="button" onClick={() => setSpiceLevel(i)} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors cursor-pointer ${spiceLevel === i ? (i === 0 ? 'bg-gray-100 border-gray-400 text-gray-800' : i === 1 ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : i === 2 ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-red-50 border-red-400 text-red-700') : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {i > 0 && '🌶'.repeat(i) + ' '}{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 border-2 border-gray-200 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-4">Dietary Info</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([{ label: 'Halal', icon: 'ri-check-double-line', value: isHalal, set: setIsHalal }, { label: 'Vegetarian', icon: 'ri-leaf-line', value: isVegetarian, set: setIsVegetarian }, { label: 'Vegan', icon: 'ri-plant-line', value: isVegan, set: setIsVegan }, { label: 'Gluten-Free', icon: 'ri-shield-check-line', value: isGlutenFree, set: setIsGlutenFree }] as { label: string; icon: string; value: boolean; set: (v: boolean) => void }[]).map(({ label, icon, value, set }) => (
                    <button key={label} type="button" onClick={() => set(!value)} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors cursor-pointer ${value ? 'bg-[#fdf9ec] border-[#C8952A] text-[#C8952A]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      <i className={`${icon} text-xl`}></i><span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 border-2 border-gray-200 rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">Protein Choice</h3>
                    <p className="text-sm text-gray-600">
                      {offersProtein
                        ? 'Customers will pick a protein (Chicken, Beef, etc.) for this dish before ordering.'
                        : 'Turn on to let customers pick a protein for this dish.'}
                      {' '}Manage the protein list under <strong>Proteins</strong> in the sidebar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffersProtein(!offersProtein)}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${offersProtein ? 'bg-[#C8952A]' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${offersProtein ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Allergens</label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map(a => (
                    <button key={a} type="button" onClick={() => toggleAllergen(a)} className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors cursor-pointer ${allergens.includes(a) ? 'bg-red-50 border-red-400 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {allergens.includes(a) && <i className="ri-alert-line mr-1"></i>}{a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Ingredients</label>
                <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} rows={3} placeholder="e.g. Rice, tomatoes, onions, scotch bonnet pepper, chicken stock..." className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] resize-none" />
              </div>

              <div className="flex items-center space-x-3">
                <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} id="featured" className="w-5 h-5 accent-[#C8952A] cursor-pointer" />
                <label htmlFor="featured" className="text-gray-900 font-medium cursor-pointer">Feature this dish on the homepage</label>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-6 max-w-3xl">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Price (CA$) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">$</span>
                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" step="0.01" min="0" className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Compare at Price (CA$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">$</span>
                    <input type="number" value={comparePrice} onChange={e => setComparePrice(e.target.value)} placeholder="0.00" step="0.01" min="0" className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Show original price with strikethrough</p>
                </div>
              </div>
              {comparePrice && price && parseFloat(comparePrice) > parseFloat(price) && (
                <div className="p-4 bg-[#fdf9ec] border border-[#e8c87a] rounded-lg">
                  <p className="text-[#7a5418] font-semibold">Discount: CA${(parseFloat(comparePrice) - parseFloat(price)).toFixed(2)} off ({(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100).toFixed(0)}%)</p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-200 space-y-6">
                <h3 className="text-lg font-bold text-gray-900">Availability</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">SKU</label>
                    <div className="flex gap-2">
                      <input type="text" value={sku} onChange={e => setSku(e.target.value)} placeholder="MKK-001" className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] font-mono text-sm" />
                      <button type="button" onClick={() => setSku(generateSku())} className="px-3 py-2 border-2 border-gray-300 rounded-lg hover:border-[#C8952A] text-gray-600 hover:text-[#C8952A] transition-colors cursor-pointer text-sm">Auto</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Daily Prep Quantity</label>
                    <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="e.g. 50" min="0" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Low Stock Alert Threshold</label>
                  <input type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} min="0" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                  <p className="text-xs text-gray-500 mt-1">Alert when daily quantity drops below this number</p>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'portions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Portions / Serving Sizes</h3>
                  <p className="text-gray-600 mt-1">Define different sizes customers can order</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={applyPortionPresets} className="px-4 py-2 border-2 border-[#C8952A]/50 text-[#C8952A] rounded-lg hover:border-[#C8952A] hover:bg-[#fdf9ec] font-semibold transition-colors cursor-pointer text-sm">
                    <i className="ri-magic-line mr-1"></i>Presets
                  </button>
                  <button type="button" onClick={addPortion} className="px-4 py-2 bg-[#111111] hover:bg-[#333] text-white rounded-lg font-semibold transition-colors cursor-pointer text-sm">
                    <i className="ri-add-line mr-1"></i>Add Portion
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Portion Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">SKU</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price (CA$)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Daily Qty</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {portions.map((portion, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 px-4"><input type="text" value={portion.name} onChange={e => updatePortion(i, 'name', e.target.value)} placeholder="e.g. Regular" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" /></td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <input type="text" value={portion.sku} onChange={e => updatePortion(i, 'sku', e.target.value)} placeholder="MKK-REG" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                            <button type="button" onClick={() => updatePortion(i, 'sku', generateSku())} className="px-2 border-2 border-gray-300 rounded-lg text-xs text-gray-500 hover:border-[#C8952A] hover:text-[#C8952A] cursor-pointer">Auto</button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input type="number" value={portion.price} onChange={e => updatePortion(i, 'price', e.target.value)} placeholder="0.00" step="0.01" min="0" className="w-full pl-7 pr-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" />
                          </div>
                        </td>
                        <td className="py-3 px-4"><input type="number" value={portion.stock} onChange={e => updatePortion(i, 'stock', e.target.value)} placeholder="0" min="0" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]" /></td>
                        <td className="py-3 px-4"><button type="button" onClick={() => removePortion(i)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"><i className="ri-delete-bin-line"></i></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-[#fdf9ec] border border-[#e8c87a] rounded-lg text-sm text-[#7a5418]">
                <i className="ri-information-line mr-2"></i>
                If you only have one size, leave just &quot;Regular&quot;. Click <strong>Presets</strong> to auto-fill Regular / Large / Family from the base price.
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Dish Images</h3>
                <p className="text-gray-600">Add up to 10 photos. The first image will be the primary display photo.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                      <img src={url} alt={`Dish ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                    {i === 0 && <span className="absolute top-2 left-2 bg-[#111111] text-white px-2 py-1 rounded text-xs font-semibold">Primary</span>}
                    <button type="button" onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow cursor-pointer"><i className="ri-close-line"></i></button>
                  </div>
                ))}
                {imageUrls.length < 10 && (
                  <label className="aspect-square border-2 border-dashed border-gray-300 rounded-xl hover:border-[#C8952A] hover:bg-[#fdf9ec] transition-colors flex flex-col items-center justify-center space-y-2 text-gray-500 hover:text-[#C8952A] cursor-pointer">
                    <i className={uploadingImage ? 'ri-loader-4-line animate-spin text-3xl' : 'ri-upload-2-line text-3xl'}></i>
                    <span className="text-sm font-semibold">{uploadingImage ? 'Uploading...' : 'Upload Photo'}</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                <strong>Tips:</strong> Use well-lit, high-quality food photos (min 800x800px). Supported: JPG, PNG, WebP (max 5MB each).
              </div>

              <div className="pt-6 border-t border-gray-200 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Dish Videos</h3>
                  <p className="text-gray-600 text-sm">Optional — upload a clip or paste a YouTube/Vimeo link so customers see your dish in action.</p>
                </div>
                {videoUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                    <i className="ri-video-line text-xl text-[#C8952A]"></i>
                    <span className="flex-1 text-sm font-mono truncate text-gray-700">{url}</span>
                    <button type="button" onClick={() => setVideoUrls(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:bg-red-50 p-2 rounded-lg cursor-pointer">
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                ))}
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#C8952A] hover:bg-[#fdf9ec] cursor-pointer text-sm font-semibold text-gray-600">
                    <i className={uploadingVideo ? 'ri-loader-4-line animate-spin' : 'ri-film-line'}></i>
                    {uploadingVideo ? 'Uploading video...' : 'Upload video (MP4)'}
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoUpload} />
                  </label>
                </div>
                <VideoUrlInput onAdd={addVideoUrl} />
              </div>
            </div>
          )}

          {activeTab === 'seo' && (() => {
            const titleAutoFill = dishName
              ? `${dishName} | Maame K\u2019s Kitchen Calgary`
              : '';
            const descAutoFill = (description || '')
              .replace(/<[^>]*>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 155);
            const effectiveTitle = seoTitle || titleAutoFill || dishName || 'Your Dish';
            const effectiveDesc = seoDesc || descAutoFill || `Order ${dishName || 'this dish'} from Maame K\u2019s Kitchen — authentic Ghanaian cuisine in Calgary.`;
            const effectiveSlug = slug || (dishName ? dishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'dish-name');
            const fullUrl = `https://maamekskitchen.ca/product/${effectiveSlug}`;
            const keywordList: string[] = keywords
              .split(',')
              .map((k: string) => k.trim())
              .filter((k: string) => k.length > 0);
            const removeKeyword = (kw: string) => setKeywords(keywordList.filter((k: string) => k !== kw).join(', '));
            const titleLen = seoTitle.length;
            const descLen = seoDesc.length;
            const titleHealth =
              titleLen === 0 ? 'empty' : titleLen < 40 ? 'short' : titleLen <= 60 ? 'great' : titleLen <= 70 ? 'long' : 'too-long';
            const descHealth =
              descLen === 0 ? 'empty' : descLen < 120 ? 'short' : descLen <= 160 ? 'great' : descLen <= 180 ? 'long' : 'too-long';
            const healthColors: Record<string, string> = {
              empty: 'bg-gray-300',
              short: 'bg-yellow-500',
              great: 'bg-green-500',
              long: 'bg-yellow-500',
              'too-long': 'bg-red-500',
            };
            const healthLabels: Record<string, string> = {
              empty: 'Empty — will use auto-generated value',
              short: 'A bit short — consider adding more detail',
              great: 'Looks great',
              long: 'Slightly long — may get truncated',
              'too-long': 'Too long — will be cut off in search results',
            };

            // Focus keyword analysis
            const fk = focusKeyword.trim().toLowerCase();
            const keywordChecks = fk
              ? {
                inTitle: effectiveTitle.toLowerCase().includes(fk),
                inDesc: effectiveDesc.toLowerCase().includes(fk),
                inSlug: effectiveSlug.toLowerCase().includes(fk),
                inDescription: (description || '').toLowerCase().includes(fk),
              }
              : null;

            const checklist = [
              { label: 'Page title set', ok: titleLen > 0 },
              { label: 'Title length 40–60 characters', ok: titleLen >= 40 && titleLen <= 60 },
              { label: 'Meta description set', ok: descLen > 0 },
              { label: 'Description length 120–160 characters', ok: descLen >= 120 && descLen <= 160 },
              { label: 'URL slug is clean (lowercase, hyphenated)', ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug) },
              { label: 'At least 3 keywords', ok: keywordList.length >= 3 },
              { label: 'Has at least one image', ok: imageUrls.length > 0 },
              { label: 'Long-form description provided', ok: (description || '').length >= 80 },
              ...(focusKeyword
                ? [
                  { label: `Focus keyword "${focusKeyword}" in title`, ok: !!keywordChecks?.inTitle },
                  { label: `Focus keyword "${focusKeyword}" in description`, ok: !!keywordChecks?.inDesc },
                  { label: `Focus keyword "${focusKeyword}" in URL slug`, ok: !!keywordChecks?.inSlug },
                ]
                : []),
            ];
            const passed = checklist.filter((c) => c.ok).length;
            const score = Math.round((passed / checklist.length) * 100);
            const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
            const scoreBarColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';

            return (
              <div className="space-y-8 max-w-4xl">
                {/* Header + score */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Search Engine Optimization</h3>
                    <p className="text-gray-600 text-sm">Help customers find this dish on Google and social media</p>
                  </div>
                  <div className="flex items-center gap-4 bg-gray-50 border-2 border-gray-200 rounded-xl px-5 py-3">
                    <div className="relative w-14 h-14">
                      <svg className="w-14 h-14 -rotate-90">
                        <circle cx="28" cy="28" r="24" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke={score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'}
                          strokeWidth="4"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 24}
                          strokeDashoffset={2 * Math.PI * 24 * (1 - score / 100)}
                        />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor}`}>{score}</span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">SEO Score</p>
                      <p className="text-sm text-gray-900 font-semibold">{passed}/{checklist.length} checks passed</p>
                    </div>
                  </div>
                </div>

                {/* Focus keyword */}
                <div className="p-5 bg-[#fdf9ec] border-2 border-[#e8c87a] rounded-xl">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-focus-3-line mr-2 text-[#C8952A]"></i>
                    Focus Keyword
                  </label>
                  <input
                    type="text"
                    value={focusKeyword}
                    onChange={e => setFocusKeyword(e.target.value)}
                    placeholder="e.g. jollof rice calgary"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] bg-white"
                  />
                  <p className="text-xs text-gray-600 mt-2">The single most important phrase you want this dish to rank for. We&apos;ll check where it appears.</p>
                  {focusKeyword && keywordChecks && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                      {[
                        { label: 'Title', ok: keywordChecks.inTitle },
                        { label: 'Description', ok: keywordChecks.inDesc },
                        { label: 'URL', ok: keywordChecks.inSlug },
                        { label: 'Long Description', ok: keywordChecks.inDescription },
                      ].map(({ label, ok }) => (
                        <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-white text-gray-500 border border-gray-200'}`}>
                          <i className={ok ? 'ri-check-line text-green-600' : 'ri-close-line text-gray-400'}></i>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Page title */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900">Page Title</label>
                    {titleAutoFill && (
                      <button type="button" onClick={() => setSeoTitle(titleAutoFill)} className="text-xs text-[#C8952A] hover:underline font-semibold cursor-pointer">
                        <i className="ri-magic-line mr-1"></i>Auto-fill from dish name
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                    placeholder={titleAutoFill || 'Your Dish | Maame K\u2019s Kitchen Calgary'}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${healthColors[titleHealth]}`}
                        style={{ width: `${Math.min(100, (titleLen / 70) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap font-mono">{titleLen}/60</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{healthLabels[titleHealth]}</p>
                </div>

                {/* Meta description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900">Meta Description</label>
                    {descAutoFill && (
                      <button type="button" onClick={() => setSeoDesc(descAutoFill)} className="text-xs text-[#C8952A] hover:underline font-semibold cursor-pointer">
                        <i className="ri-magic-line mr-1"></i>Auto-fill from description
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={seoDesc}
                    onChange={e => setSeoDesc(e.target.value)}
                    placeholder={descAutoFill || `Order ${dishName || 'this dish'} from Maame K\u2019s Kitchen — authentic Ghanaian cuisine in Calgary.`}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] resize-none"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${healthColors[descHealth]}`}
                        style={{ width: `${Math.min(100, (descLen / 180) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap font-mono">{descLen}/160</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{healthLabels[descHealth]}</p>
                </div>

                {/* URL slug */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900">URL Slug</label>
                    {dishName && (
                      <button
                        type="button"
                        onClick={() => setSlug(dishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))}
                        className="text-xs text-[#C8952A] hover:underline font-semibold cursor-pointer"
                      >
                        <i className="ri-refresh-line mr-1"></i>Regenerate from name
                      </button>
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-600 bg-gray-100 px-4 py-3 border-2 border-r-0 border-gray-300 rounded-l-lg text-sm whitespace-nowrap font-mono">maamekskitchen.ca/product/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder={effectiveSlug}
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A] font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers and hyphens only. Auto-cleaned as you type.</p>
                </div>

                {/* Keywords as chips */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Keywords</label>
                  {keywordList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {keywordList.map((kw: string) => (
                        <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fdf9ec] border border-[#e8c87a] text-[#7a5418] rounded-full text-sm font-medium">
                          {kw}
                          <button type="button" onClick={() => removeKeyword(kw)} className="text-[#a07020] hover:text-red-500 cursor-pointer">
                            <i className="ri-close-line"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="jollof rice, ghanaian food calgary, african food calgary"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate keywords with commas. Aim for 3–7 specific phrases.</p>
                </div>

                {/* Search engine visibility */}
                <div className="p-5 border-2 border-gray-200 rounded-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label htmlFor="noindex" className="block text-sm font-bold text-gray-900 mb-1">
                        Search Engine Visibility
                      </label>
                      <p className="text-sm text-gray-600">
                        {noindex
                          ? 'Hidden from Google — this dish will not appear in search results.'
                          : 'Visible — Google and other search engines may index this dish.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNoindex(!noindex)}
                      id="noindex"
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${noindex ? 'bg-gray-400' : 'bg-[#C8952A]'}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${noindex ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Google search preview */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-google-fill text-base text-[#4285F4]"></i>
                    Google Search Preview
                  </h4>
                  <div className="p-5 border-2 border-gray-200 rounded-xl bg-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        <i className="ri-restaurant-line text-sm text-[#C8952A]"></i>
                      </div>
                      <div className="text-xs">
                        <div className="text-gray-900 font-medium">Maame K&rsquo;s Kitchen</div>
                        <div className="text-gray-500">maamekskitchen.ca › product › {effectiveSlug}</div>
                      </div>
                    </div>
                    <h5 className="text-[#1a0dab] text-lg leading-tight hover:underline cursor-pointer font-normal truncate" style={{ fontFamily: 'arial, sans-serif' }}>
                      {effectiveTitle.length > 60 ? `${effectiveTitle.slice(0, 57)}…` : effectiveTitle}
                    </h5>
                    <p className="text-sm text-gray-700 mt-1 leading-snug" style={{ fontFamily: 'arial, sans-serif' }}>
                      {effectiveDesc.length > 160 ? `${effectiveDesc.slice(0, 157)}…` : effectiveDesc}
                    </p>
                  </div>
                </div>

                {/* Social share preview */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-share-line text-base text-[#C8952A]"></i>
                    Social Share Preview
                  </h4>
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white max-w-md">
                    <div className="aspect-[1.91/1] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                      {imageUrls[0] ? (
                        <img src={imageUrls[0]} alt="Share preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                          <i className="ri-image-line text-4xl mb-2"></i>
                          <p className="text-xs">Add an image on the Images tab</p>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">maamekskitchen.ca</p>
                      <h5 className="font-semibold text-gray-900 line-clamp-2 leading-tight mb-1">{effectiveTitle}</h5>
                      <p className="text-sm text-gray-600 line-clamp-2 leading-snug">{effectiveDesc}</p>
                    </div>
                  </div>
                </div>

                {/* SEO checklist */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-checkbox-multiple-line text-base text-[#C8952A]"></i>
                    SEO Health Checklist
                  </h4>
                  <div className="p-5 border-2 border-gray-200 rounded-xl bg-white space-y-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${scoreBarColor}`} style={{ width: `${score}%` }} />
                      </div>
                      <span className={`text-sm font-bold ${scoreColor} font-mono whitespace-nowrap`}>{score}%</span>
                    </div>
                    {checklist.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 py-2 ${i < checklist.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.ok ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <i className={item.ok ? 'ri-check-line' : 'ri-close-line'}></i>
                        </div>
                        <span className={`text-sm ${item.ok ? 'text-gray-700' : 'text-gray-500'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final URL preview */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                  <i className="ri-links-line text-xl text-gray-500 flex-shrink-0"></i>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">This dish will live at</p>
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#C8952A] hover:underline font-mono truncate block">
                      {fullUrl}
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

