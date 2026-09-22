'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { api } from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Award,
  ShieldCheck,
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  Info,
} from 'lucide-react';

export interface CustomerForEdit {
  _id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit: number;
  currentDueBalance: number;
  loyaltyPoints: number;
  isActive: boolean;
}

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCustomer: CustomerForEdit) => void;
  customer: CustomerForEdit | null;
  isSuperAdmin?: boolean;
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
  isSuperAdmin = false,
}) => {
  const toast = useToast();

  // Form fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate form when customer changes
  useEffect(() => {
    if (!isOpen || !customer) return;
    setName(customer.name);
    setContactPerson(customer.contactPerson || '');
    setPhone(customer.phone);
    setEmail(customer.email || '');
    setAddress(customer.address || '');
    setCreditLimit(customer.creditLimit ?? 0);
    setLoyaltyPoints(customer.loyaltyPoints ?? 0);
    setIsActive(customer.isActive ?? true);
    setError('');
  }, [isOpen, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setError('A valid phone number is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        creditLimit: Number(creditLimit) || 0,
        isActive,
      };

      // Super admin can override loyalty points directly
      if (isSuperAdmin) {
        payload.loyaltyPoints = Number(loyaltyPoints) || 0;
      }

      const res = await api.put(`/customers/${customer._id}`, payload);
      const updated = res.data?.data ?? res.data;

      toast.success('Customer account updated successfully.');
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to update customer.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!customer) return null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', minimumFractionDigits: 2 }).format(v);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          Edit Customer Account
        </span>
      }
      subtitle={`Editing: ${customer.name} • ${customer.phone}`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Due Balance — read-only info */}
        <div className="flex items-center gap-3 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl text-xs text-amber-300">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Current Due Balance:{' '}
            <strong className="text-amber-200">{formatCurrency(customer.currentDueBalance)}</strong>
            {' '}— এটি ledger থেকে নিয়ন্ত্রিত। Balance ঠিক করতে ledger এ গিয়ে entry edit করুন।
          </span>
        </div>

        {/* ── Basic Info ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Basic Information
          </p>
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <User className="w-3 h-3 inline mr-1" />
                Customer / Shop Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company / shop name"
                required
                className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Contact person / owner */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <User className="w-3 h-3 inline mr-1" />
                Contact Person / Owner{' '}
                <span className="normal-case font-normal text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. the owner's name"
                className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <Phone className="w-3 h-3 inline mr-1" />
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01XXXXXXXXX"
                required
                className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <Mail className="w-3 h-3 inline mr-1" />
                Email{' '}
                <span className="normal-case font-normal text-slate-500">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <MapPin className="w-3 h-3 inline mr-1" />
                Address{' '}
                <span className="normal-case font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop/house address..."
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Account Settings ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Account Settings
          </p>
          <div className="space-y-3">
            {/* Credit Limit */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <CreditCard className="w-3 h-3 inline mr-1" />
                Credit Limit (৳)
              </label>
              <NumberInput
                min={0}
                value={creditLimit}
                onValueChange={setCreditLimit}
                className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Maximum due balance allowed for this customer.
              </p>
            </div>

            {/* Loyalty Points — Super Admin only */}
            {isSuperAdmin && (
              <div className="p-3 bg-indigo-500/8 border border-indigo-500/20 rounded-xl">
                <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1.5">
                  <Award className="w-3 h-3 inline mr-1" />
                  Loyalty Points{' '}
                  <span className="text-[10px] font-normal text-indigo-500 normal-case ml-1">
                    (Super Admin override)
                  </span>
                </label>
                <NumberInput
                  min={0}
                  value={loyaltyPoints}
                  onValueChange={setLoyaltyPoints}
                  className="w-full h-10 px-3.5 bg-slate-800 border border-indigo-500/30 rounded-lg text-sm text-white font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            )}

            {/* Active / Inactive Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-800/60 border border-slate-700 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-200">Account Status</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Inactive customers cannot make purchases.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  isActive ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                aria-label="Toggle account status"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div
              className={`flex items-center gap-2 text-xs font-medium px-1 transition-colors ${
                isActive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isActive ? (
                <>
                  <BadgeCheck className="w-3.5 h-3.5" /> Account is Active
                </>
              ) : (
                <>
                  <BadgeX className="w-3.5 h-3.5" /> Account will be set to Inactive
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
