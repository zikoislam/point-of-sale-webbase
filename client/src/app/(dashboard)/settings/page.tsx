'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, Store, Printer, Tag, RefreshCw, Check } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
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
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
    />
  </div>
);

export default function SettingsPage() {
  const [form, setForm] = useState<ShopSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/settings`, { headers: authHeader() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setForm({ ...defaultSettings, ...j.data }); })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings`, {
        method: 'PUT', headers: authHeader(), body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.success) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
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
