'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../lib/api-client';
import { useToast } from '../ui/Toast';

interface BrandFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brand?: any | null;
}

export const BrandFormModal: React.FC<BrandFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  brand,
}) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (brand) {
      setName(brand.name || '');
      setOriginCountry(brand.originCountry || '');
      setLogoUrl(brand.logoUrl || '');
      setIsActive(brand.isActive !== false);
    } else {
      setName('');
      setOriginCountry('');
      setLogoUrl('');
      setIsActive(true);
    }
    setError('');
  }, [isOpen, brand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Brand name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      originCountry: originCountry.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      isActive,
    };

    try {
      if (brand) {
        await api.put(`/brands/${brand.id || brand._id}`, payload);
        toast.success(`Brand "${name}" updated successfully.`);
      } else {
        await api.post('/brands', payload);
        toast.success(`Brand "${name}" created successfully.`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save brand.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={brand ? 'Edit Brand' : 'Add Brand'}
      subtitle="Manage manufacturer or brand labels"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <Input
          label="Brand Name"
          placeholder="e.g. Unilever, Nestlé, Square"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Origin Country"
          placeholder="e.g. Bangladesh, South Korea"
          value={originCountry}
          onChange={(e) => setOriginCountry(e.target.value)}
        />

        <Input
          label="Logo URL (Optional)"
          placeholder="https://example.com/logo.png"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
        />

        <div className="flex items-center gap-2 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span>Active Brand</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {brand ? 'Update Brand' : 'Save Brand'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
