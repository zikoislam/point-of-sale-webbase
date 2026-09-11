'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Tags, Plus, Pencil, Trash2, ChevronRight, RefreshCw, X, Check } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  defaultTaxRate: number;
  parentId?: string;
  parentName?: string;
  isActive: boolean;
  children?: Category[];
}

const emptyForm = { name: '', code: '', description: '', defaultTaxRate: 0, parentId: '' };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatList, setFlatList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, flatRes] = await Promise.all([
        fetch(`${API}/categories`, { headers: authHeader() }),
        fetch(`${API}/categories?flat=true`, { headers: authHeader() }),
      ]);
      const tree = await treeRes.json();
      const flat = await flatRes.json();
      if (tree.success) setCategories(tree.data);
      if (flat.success) setFlatList(flat.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setForm({ name: cat.name, code: cat.code, description: cat.description || '', defaultTaxRate: cat.defaultTaxRate, parentId: cat.parentId || '' });
    setError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const body = { name: form.name, code: form.code || undefined, description: form.description || undefined, defaultTaxRate: form.defaultTaxRate, parentId: form.parentId || undefined };
      const url = editTarget ? `${API}/categories/${editTarget.id}` : `${API}/categories`;
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed');
      setShowModal(false);
      fetchCategories();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const res = await fetch(`${API}/categories/${id}`, { method: 'DELETE', headers: authHeader() });
    const j = await res.json();
    if (j.success) fetchCategories();
    else alert(j.message);
  };

  const CategoryRow = ({ cat, depth = 0 }: { cat: Category; depth?: number }) => (
    <>
      <tr className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group">
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
            {depth > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
            <span className="font-medium text-white text-sm">{cat.name}</span>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className="font-mono text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">{cat.code}</span>
        </td>
        <td className="px-5 py-3.5 text-slate-400 text-sm">{cat.defaultTaxRate}%</td>
        <td className="px-5 py-3.5 text-slate-400 text-sm">{cat.parentName || '—'}</td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openEdit(cat)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {cat.children?.map((child) => <CategoryRow key={child.id} cat={child} depth={depth + 1} />)}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Tags className="w-5 h-5 text-indigo-400" />Categories</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage product categories and hierarchy</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCategories} className="p-2.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/30">
              {['Name', 'Code', 'Tax Rate', 'Parent', 'Actions'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="py-16 text-center text-slate-500">
                <Tags className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No categories yet</p>
              </td></tr>
            ) : (
              categories.map((cat) => <CategoryRow key={cat.id} cat={cat} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white text-sm">{editTarget ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl px-4 py-3">{error}</div>}
              {[
                { label: 'Name *', key: 'name', placeholder: 'e.g. Beverages' },
                { label: 'Code (auto-generated if blank)', key: 'code', placeholder: 'e.g. BEV' },
                { label: 'Description', key: 'description', placeholder: 'Optional description' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                  <input
                    value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-500"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Default Tax Rate (%)</label>
                  <input type="number" value={form.defaultTaxRate} min={0} max={100}
                    onChange={(e) => setForm((f) => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Parent Category</label>
                  <select value={form.parentId}
                    onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="">None (Root)</option>
                    {flatList.filter((c) => c.id !== editTarget?.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 text-sm font-medium transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
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
