'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, Store, Printer, Tag, RefreshCw, Check, Image as ImageIcon, Upload, Trash2, ShieldCheck, Copy } from 'lucide-react';
import { uploadImage } from '../../../lib/upload';
import { invalidateBranding } from '../../../hooks/useBranding';
import { electronBridge, isElectron, type LicenseInfo } from '../../../lib/electron-bridge';
import { availablePrinters, printTestSlip } from '../../../lib/receipt-printer';

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

/** Which output the receipt uses, and how that output is configured. */
type HardwarePrefs = {
  printMode?: 'thermal' | 'document';
  printerName?: string;
  paperWidth?: '58mm' | '80mm';
  documentPrinterName?: string;
  paperSize?: 'A4' | 'Letter';
  showPrintDialog?: boolean;
};

/** Why a licence key was refused, in words the shop can act on. */
const LICENSE_ERRORS: Record<string, string> = {
  missing: 'Enter a license key first.',
  malformed: 'This is not a valid key. Copy the whole line from the message you were sent.',
  'bad-signature': 'This key was not issued by Bdbbc.com. Please check it and try again.',
  'wrong-machine': 'This key was issued for a different computer. Send the Machine ID below to get one for this PC.',
  expired: 'This key has already expired. Please ask for a new one.',
};

/** Human wording for how long is left, and how urgent it is. */
const licenceExpiryNote = (licence: LicenseInfo | null): { text: string; tone: string } => {
  if (!licence?.expiresAt) return { text: 'No license installed', tone: 'text-red-400' };
  if (licence.daysRemaining === null) return { text: '—', tone: 'text-slate-500' };

  if (licence.daysRemaining < 0) return { text: 'Expired', tone: 'text-red-400' };
  if (licence.daysRemaining === 0) return { text: 'Expires today', tone: 'text-amber-400' };
  if (licence.daysRemaining <= 15) {
    return { text: `${licence.daysRemaining} days left — request a new key`, tone: 'text-amber-400' };
  }
  return { text: `${licence.daysRemaining} days left`, tone: 'text-emerald-400' };
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

  // Thermal printer settings live in the desktop app's own config, because the
  // printer is attached to the till rather than to the server.
  const desktop = isElectron();
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [printerName, setPrinterName] = useState('');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [printMode, setPrintMode] = useState<'thermal' | 'document'>('thermal');
  const [documentPrinterName, setDocumentPrinterName] = useState('');
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [hardwareMsg, setHardwareMsg] = useState('');
  const [testing, setTesting] = useState(false);

  // Licence details live in the desktop app's own files, not in shop settings.
  const [licence, setLicence] = useState<LicenseInfo | null>(null);
  const [licenceKey, setLicenceKey] = useState('');
  const [licenceMsg, setLicenceMsg] = useState('');
  const [licenceError, setLicenceError] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!desktop) return;

    (async () => {
      const config = await electronBridge.getConfig();
      setPrinterName(config?.hardware?.printerName || '');
      setPaperWidth(config?.hardware?.paperWidth || '80mm');
      setPrintMode(config?.hardware?.printMode || 'thermal');
      setDocumentPrinterName(config?.hardware?.documentPrinterName || '');
      setPaperSize(config?.hardware?.paperSize || 'A4');
      setShowPrintDialog(Boolean(config?.hardware?.showPrintDialog));
      setPrinters(await availablePrinters());
      setLicence(await electronBridge.licenseStatus());
    })();
  }, [desktop]);

  const saveHardware = async (patch: HardwarePrefs) => {
    const ok = await electronBridge.setConfig({ hardware: patch });
    setHardwareMsg(ok ? 'Printer settings saved.' : 'Could not save printer settings.');
  };

  const choosePrintMode = (mode: 'thermal' | 'document') => {
    setPrintMode(mode);
    void saveHardware({ printMode: mode });
  };

  const chooseReceiptPrinter = (name: string) => {
    setPrinterName(name);
    void saveHardware({ printerName: name });
  };

  const choosePaperWidth = (width: '58mm' | '80mm') => {
    setPaperWidth(width);
    void saveHardware({ paperWidth: width });
  };

  const chooseDocumentPrinter = (name: string) => {
    setDocumentPrinterName(name);
    void saveHardware({ documentPrinterName: name });
  };

  const choosePaperSize = (size: 'A4' | 'Letter') => {
    setPaperSize(size);
    void saveHardware({ paperSize: size });
  };

  const togglePrintDialog = (enabled: boolean) => {
    setShowPrintDialog(enabled);
    void saveHardware({ showPrintDialog: enabled });
  };

  const runTestPrint = async () => {
    setTesting(true);
    setHardwareMsg('');
    try {
      const result = await printTestSlip(form.shopName, {
        printMode,
        printerName: printerName || undefined,
        paperWidth,
        documentPrinterName: documentPrinterName || undefined,
        paperSize,
        showPrintDialog,
      });
      setHardwareMsg(
        result.success
          ? `Test ${printMode === 'document' ? 'page' : 'slip'} sent to ${result.printerName || 'the default printer'}.`
          : result.error || 'The test print failed.'
      );
    } finally {
      setTesting(false);
    }
  };

  const submitLicenceKey = async () => {
    const key = licenceKey.trim();

    if (!key) {
      setLicenceError(true);
      setLicenceMsg(LICENSE_ERRORS.missing);
      return;
    }

    setActivating(true);
    setLicenceError(false);
    setLicenceMsg('');

    try {
      const result = await electronBridge.activateLicense(key);

      if (result.success) {
        setLicenceKey('');
        setLicence(await electronBridge.licenseStatus());
        setLicenceMsg('License accepted — this computer is activated.');
        return;
      }

      setLicenceError(true);
      setLicenceMsg(
        LICENSE_ERRORS[result.reason || ''] || result.message || 'The key could not be accepted.'
      );
    } finally {
      setActivating(false);
    }
  };

  const copyMachineId = async () => {
    if (!licence) return;

    setLicenceError(false);
    try {
      await navigator.clipboard.writeText(licence.machineIdFormatted);
      setLicenceMsg('Machine ID copied to the clipboard.');
    } catch {
      setLicenceError(true);
      setLicenceMsg('Could not copy automatically — select the number and copy it by hand.');
    }
  };

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

  const expiryNote = licenceExpiryNote(licence);

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

      {/* License — desktop only. The key lives in the app's own files rather
          than in shop settings, because it belongs to this computer. */}
      {desktop && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> License
            </h2>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                licence?.licensed
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-red-400 bg-red-500/10 border-red-500/30'
              }`}
            >
              {licence?.licensed ? 'Active' : 'Not active'}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            The license for this computer. Enter the next key before the expiry date — once it
            lapses the app will not open until a new key is entered. Business data is never affected.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1.5">Registered to</div>
              <div className="text-sm text-white">{licence?.customer || '—'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Serial {licence?.serial || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1.5">Valid until</div>
              <div className="text-sm text-white">{licence?.expiresAt || '—'}</div>
              <div className={`text-xs mt-0.5 ${expiryNote.tone}`}>{expiryNote.text}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Machine ID — send this when requesting a key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-indigo-300">
                {licence?.machineIdFormatted || '…'}
              </div>
              <button
                type="button"
                onClick={copyMachineId}
                disabled={!licence}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl border border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <label className="block text-xs font-medium text-slate-400">Enter a new license key</label>
            <textarea
              value={licenceKey}
              onChange={(e) => setLicenceKey(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder="POS1.…"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-500"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submitLicenceKey}
                disabled={activating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl"
              >
                {activating ? 'Checking…' : 'Activate'}
              </button>
              {licenceMsg && (
                <span className={`text-xs ${licenceError ? 'text-red-400' : 'text-emerald-400'}`}>
                  {licenceMsg}
                </span>
              )}
            </div>
          </div>

          {licence && (
            <p className="text-xs text-slate-500">
              Support: {licence.supportCompany} — {licence.supportPhone}
            </p>
          )}
        </div>
      )}

      {/* Receipt printing — the printer hangs off this computer, so these
          settings live in the desktop app's own config, not on the server. */}
      {desktop && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white text-sm flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-400" /> Receipt Printing (this computer)
          </h2>
          <p className="text-xs text-slate-400">
            Choose where receipts are printed. Most shops use a thermal roll printer; pick the
            second option to print a full-page invoice on an ordinary printer such as A4.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => choosePrintMode('thermal')}
              className={`text-left rounded-xl border p-4 transition-colors ${
                printMode === 'thermal'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800'
              }`}
            >
              <div className="text-sm font-semibold text-white">Thermal receipt printer</div>
              <div className="text-xs text-slate-400 mt-1">
                58mm / 80mm roll, prints instantly, no dialog
              </div>
            </button>

            <button
              type="button"
              onClick={() => choosePrintMode('document')}
              className={`text-left rounded-xl border p-4 transition-colors ${
                printMode === 'document'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800'
              }`}
            >
              <div className="text-sm font-semibold text-white">Normal printer (A4 / Letter)</div>
              <div className="text-xs text-slate-400 mt-1">
                Any printer installed in Windows, full-page invoice
              </div>
            </button>
          </div>

          {printMode === 'thermal' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Receipt printer</label>
                <select
                  value={printerName}
                  onChange={(e) => chooseReceiptPrinter(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  <option value="">
                    System default{printers.find((p) => p.isDefault) ? ` (${printers.find((p) => p.isDefault)!.name})` : ''}
                  </option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name}{printer.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  The cash drawer opens through this printer.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Paper width</label>
                <select
                  value={paperWidth}
                  onChange={(e) => choosePaperWidth(e.target.value as '58mm' | '80mm')}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  <option value="80mm">80mm — 48 characters</option>
                  <option value="58mm">58mm — 32 characters</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Invoice printer</label>
                  <select
                    value={documentPrinterName}
                    onChange={(e) => chooseDocumentPrinter(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  >
                    <option value="">
                      System default{printers.find((p) => p.isDefault) ? ` (${printers.find((p) => p.isDefault)!.name})` : ''}
                    </option>
                    {printers.map((printer) => (
                      <option key={printer.name} value={printer.name}>
                        {printer.name}{printer.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Paper size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => choosePaperSize(e.target.value as 'A4' | 'Letter')}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  >
                    <option value="A4">A4 — 210 × 297 mm</option>
                    <option value="Letter">Letter — 8.5 × 11 in</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrintDialog}
                  onChange={(e) => togglePrintDialog(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50"
                />
                <span className="text-xs text-slate-300">
                  Show the Windows print dialog before printing
                  <span className="block text-slate-500 mt-0.5">
                    Leave this off to print straight away, the way a thermal printer does.
                  </span>
                </span>
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Cash drawer printer (thermal)
                </label>
                <select
                  value={printerName}
                  onChange={(e) => chooseReceiptPrinter(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  <option value="">System default</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name}{printer.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  The drawer is wired to a receipt printer, so it still needs one even when the
                  receipt itself prints on A4.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runTestPrint}
              disabled={testing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl border border-slate-700"
            >
              {testing ? 'Printing…' : printMode === 'document' ? 'Test page' : 'Test print'}
            </button>
            {printers.length === 0 && (
              <span className="text-xs text-amber-400">
                No printers found — install the printer driver in Windows first.
              </span>
            )}
            {hardwareMsg && <span className="text-xs text-slate-300">{hardwareMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
