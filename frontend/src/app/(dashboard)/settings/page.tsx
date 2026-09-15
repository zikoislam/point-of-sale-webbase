'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, Store, Printer, Tag, RefreshCw, Check, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { uploadImage } from '../../../lib/upload';
import { invalidateBranding } from '../../../hooks/useBranding';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  'Content-Type': 'application/json',
});
const fetchOpts = (opts: RequestInit = {}): RequestInit => ({
  ...opts,
  credentials: 'include' as RequestCredentials,
  headers: { ...authHeader(), ...(opts.headers as Record<string, string> || {}) },
});

interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail?: string;
  currencySymbol: string;
  defaultTaxRate: number;
  allowNegativeStock: boolean;
  thermalPrinterType: '58mm' | '80mm';
  barcodeLabelFormat: string;
  receiptHeader: string;
  receiptFooter: string;
  logoUrl?: string;
}

const defaultSettings: ShopSettings = {
  shopName: '', shopAddress: '', shopPhone: '', shopEmail: '',
  currencySymbol: '৳', defaultTaxRate: 0, allowNegativeStock: false,
  thermalPrinterType: '80mm', barcodeLabelFormat: '38mm_x_25mm_2up',
  receiptHeader: '', receiptFooter: '',
};

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
    <input
      type={type === 'number' ? 'text' : type}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={value} placeholder={placeholder}
      onChange={(e) => {
        let val = e.target.value;
        if (type === 'number') {
          val = val.replace(/[^0-9.-]/g, '').replace(/^(-?)0+(?=\d)/, '$1');
        }
        onChange(val);
      }}
      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
    />
  </div>
);

export default function SettingsPage() {
  const [form, setForm] = useState<ShopSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  const handleLogoSelect = async (file: File | undefined) => {
    if (!file) return;
    setLogoUploading(true);
    setLogoError('');
    try {
      const url = await uploadImage(file, 'image');
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err: any) {
      setLogoError(err?.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  useEffect(() => {
    fetch(`${API}/settings`, fetchOpts())
      .then((r) => r.json())
      .then((j) => { if (j.success) setForm({ ...defaultSettings, ...j.data }); })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings`, fetchOpts({
        method: 'PUT', body: JSON.stringify(form),
      }));
      const j = await res.json();
      if (j.success) {
        invalidateBranding();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally { setSaving(false); }
  };

  const set = (key: keyof ShopSettings) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" /> Shop Settings
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Configure your store information and hardware</p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg ${
            saved
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 disabled:opacity-60'
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Company Logo (Super Admin) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
          <ImageIcon className="w-4 h-4 text-indigo-400" /> Company Logo
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Company logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Store className="w-9 h-9 text-slate-600" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition">
                <Upload className="w-4 h-4" />
                <span>{logoUploading ? 'Uploading...' : 'Upload Logo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={logoUploading}
                  onChange={(e) => handleLogoSelect(e.target.files?.[0])}
                />
              </label>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              PNG, JPG, WEBP or GIF — max 2 MB. Appears on the sidebar, login screen and receipts.
              Remember to click &quot;Save Changes&quot;.
            </p>
            {logoError && <p className="text-[11px] text-rose-400 font-medium">{logoError}</p>}
          </div>
        </div>
      </div>

      {/* Shop Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Store className="w-4 h-4 text-indigo-400" /> Store Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Shop Name" value={form.shopName} onChange={set('shopName')} placeholder="Al-Amin Traders" />
          <Field label="Phone" value={form.shopPhone} onChange={set('shopPhone')} placeholder="01XXXXXXXXX" />
          <div className="sm:col-span-2">
            <Field label="Address" value={form.shopAddress} onChange={set('shopAddress')} placeholder="Shop address" />
          </div>
          <Field label="Email (optional)" value={form.shopEmail || ''} onChange={set('shopEmail')} placeholder="shop@email.com" />
          <Field label="Currency Symbol" value={form.currencySymbol} onChange={set('currencySymbol')} placeholder="৳" />
        </div>
      </div>

      {/* Tax & Stock */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Tag className="w-4 h-4 text-indigo-400" /> Tax & Inventory
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Default Tax Rate (%)" value={form.defaultTaxRate} onChange={(v) => setForm((f) => ({ ...f, defaultTaxRate: parseFloat(v) || 0 }))} type="number" placeholder="0" />
          <div className="flex items-center gap-3 pt-5">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, allowNegativeStock: !f.allowNegativeStock }))}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.allowNegativeStock ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.allowNegativeStock ? 'left-5' : 'left-1'}`} />
            </button>
            <span className="text-sm text-slate-300">Allow Negative Stock</span>
          </div>
        </div>
      </div>

      {/* Hardware */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4 text-indigo-400" /> Hardware Configuration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Thermal Printer Type</label>
            <select
              value={form.thermalPrinterType}
              onChange={(e) => setForm((f) => ({ ...f, thermalPrinterType: e.target.value as any }))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            >
              <option value="80mm">80mm (Standard)</option>
              <option value="58mm">58mm (Compact)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Barcode Label Format</label>
            <select
              value={form.barcodeLabelFormat}
              onChange={(e) => setForm((f) => ({ ...f, barcodeLabelFormat: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            >
              <option value="38mm_x_25mm_2up">38×25mm (2-up)</option>
              <option value="50mm_x_30mm">50×30mm Thermal</option>
              <option value="a4_24_sheet">A4 Grid (24 labels/sheet)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white text-sm">Receipt Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Receipt Header Text</label>
            <textarea
              value={form.receiptHeader} rows={2}
              onChange={(e) => setForm((f) => ({ ...f, receiptHeader: e.target.value }))}
              placeholder="Text printed at the top of every receipt..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Receipt Footer Text</label>
            <textarea
              value={form.receiptFooter} rows={2}
              onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))}
              placeholder="Thank you! Return policy: 7 days..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
