'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Protein = {
  id: string;
  name: string;
  description: string | null;
  price_delta: number;
  image_url: string | null;
  is_active: boolean;
  position: number;
};

const emptyForm = {
  name: '',
  description: '',
  price_delta: '',
  image_url: '',
  is_active: true,
};

export default function AdminProteinsPage() {
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchProteins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proteins')
        .select('*')
        .order('position', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      setProteins((data as Protein[]) || []);
    } catch (err) {
      console.error('Error fetching proteins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProteins();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (p: Protein) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      price_delta: p.price_delta ? String(p.price_delta) : '',
      image_url: p.image_url || '',
      is_active: p.is_active,
    });
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `proteins/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('products').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: publicUrl }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      alert('Could not upload photo: ' + message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      alert('Protein name is required');
      return;
    }
    const priceDelta = form.price_delta ? parseFloat(form.price_delta) : 0;
    if (isNaN(priceDelta) || priceDelta < 0) {
      alert('Enter a valid extra charge (0 or more)');
      return;
    }

    setSaving(true);
    const payload = {
      name,
      description: form.description.trim() || null,
      price_delta: priceDelta,
      image_url: form.image_url || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('proteins').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const nextPosition = proteins.length
          ? Math.max(...proteins.map((p) => p.position || 0)) + 1
          : 0;
        const { error } = await supabase.from('proteins').insert([{ ...payload, position: nextPosition }]);
        if (error) throw error;
      }
      setShowModal(false);
      await fetchProteins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      alert('Could not save protein: ' + message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Protein) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('proteins').delete().eq('id', p.id);
    if (error) {
      alert('Delete failed: ' + error.message);
      return;
    }
    await fetchProteins();
  };

  const toggleActive = async (p: Protein) => {
    const { error } = await supabase
      .from('proteins')
      .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) {
      alert('Update failed: ' + error.message);
      return;
    }
    await fetchProteins();
  };

  const activeCount = proteins.filter((p) => p.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proteins</h1>
          <p className="text-gray-600 mt-1">
            Add protein options customers can choose (e.g. Chicken, Beef, Fish, Goat)
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-[#111111] hover:bg-[#333] text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Add Protein
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{proteins.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-[#C8952A]">{activeCount}</p>
        </div>
      </div>

      <div className="bg-[#fdf9ec] border border-[#e8c87a] rounded-lg p-4 text-sm text-[#7a5418]">
        <i className="ri-information-line mr-2"></i>
        These proteins show on any dish where you turn on{' '}
        <strong>&ldquo;Let customers choose a protein&rdquo;</strong> (in the dish&apos;s General tab).
        Set an extra charge if a protein costs more, or leave it at 0.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">All Proteins</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading proteins...</div>
        ) : proteins.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ri-restaurant-2-line text-4xl text-gray-300 mb-3 block"></i>
            <p className="text-gray-500">No proteins yet. Add your first one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {proteins.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <i className="ri-restaurant-2-line text-xl text-gray-300"></i>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-500 truncate">{p.description}</p>}
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="font-semibold text-gray-900">
                    {p.price_delta > 0 ? `+ $${Number(p.price_delta).toFixed(2)}` : 'No extra'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#C8952A] hover:bg-[#fdf9ec] rounded-lg transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <i className="ri-edit-line text-lg"></i>
                  </button>
                  <button
                    onClick={() => toggleActive(p)}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#C8952A] hover:bg-[#fdf9ec] rounded-lg transition-colors cursor-pointer"
                    title={p.is_active ? 'Hide from customers' : 'Show to customers'}
                  >
                    <i className={`${p.is_active ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <i className="ri-delete-bin-line text-lg"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Protein' : 'Add Protein'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Chicken, Beef, Fish, Goat"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Grilled, boneless (optional)"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Extra Charge (CA$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price_delta}
                    onChange={(e) => setForm((f) => ({ ...f, price_delta: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C8952A] focus:border-[#C8952A]"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Added to the dish price when a customer picks this protein. Leave 0 for no extra charge.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Photo (optional)</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center border-2 border-gray-200">
                    {form.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.image_url} alt="Protein" className="w-full h-full object-cover" />
                    ) : (
                      <i className="ri-image-line text-2xl text-gray-300"></i>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#C8952A] hover:bg-[#fdf9ec] cursor-pointer text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <i className={uploading ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'}></i>
                      {uploading ? 'Uploading...' : 'Upload photo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    {form.image_url && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                        className="text-xs text-red-500 hover:underline text-left cursor-pointer"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-5 h-5 accent-[#C8952A]"
                />
                <span className="text-sm font-medium text-gray-900">Active — customers can choose this protein</span>
              </label>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-[#111111] text-white rounded-lg font-semibold hover:bg-[#333] disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : editingId ? 'Update Protein' : 'Add Protein'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
