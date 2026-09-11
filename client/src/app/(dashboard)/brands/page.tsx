'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Building2, Plus, Pencil, Trash2, Globe, RefreshCw, X, Check } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface Brand { id: string; name: string; originCountry?: string; logoUrl?: string; isActive: boolean; createdAt: string; }

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: '', originCountry: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/brands`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) setBrands(j.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const openCreate = () => { setEditTarget(null); setForm({ name: '', originCountry: '', logoUrl: '' }); setError(''); setShowModal(true); };
  const openEdit = (b: Brand) => { setEditTarget(b); setForm({ name: b.name, originCountry: b.originCountry || '', logoUrl: b.logoUrl || '' }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Brand name is required'); return; }
    setSaving(true); setError('');
    try {
      const url = editTarget ? `${API}/brands/${editTarget.id}` : `${API}/brands`;
      const method = editTarget ? 'PUT' : 'POST';
      const body = { name: form.name, originCountry: form.originCountry || undefined, logoUrl: form.logoUrl || undefined };
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed');
      setShowModal(false); fetchBrands();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand?')) return;
    const res = await fetch(`${API}/brands/${id}`, { method: 'DELETE', headers: authHeader() });
    const j = await res.json();
    if (j.success) fetchBrands(); else alert(j.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-indigo-400" />Brands</h1>
          <p className="text-slate-400 text-sm mt-0.5">{brands.length} brand{brands.length !== 1 ? 's' : ''} in catalog</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchBrands} className="p-2.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" /> Add Brand
          </button>
        </div>
      </div>

      {/* Brand Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No brands yet</p>
          <p className="text-sm mt-1">Click "Add Brand" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {brands.map((brand) => (
            <div key={brand.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm">
                  {brand.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(brand)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(brand.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-white text-sm">{brand.name}</h3>
              {brand.originCountry && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {brand.originCountry}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white text-sm">{editTarget ? 'Edit Brand' : 'New Brand'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl px-4 py-3">{error}</div>}
              {[
                { label: 'Brand Name *', key: 'name', placeholder: 'e.g. Samsung' },
                { label: 'Origin Country', key: 'originCountry', placeholder: 'e.g. South Korea' },
                { label: 'Logo URL (optional)', key: 'logoUrl', placeholder: 'https://...' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                  <input value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-500"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 text-sm font-medium transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
