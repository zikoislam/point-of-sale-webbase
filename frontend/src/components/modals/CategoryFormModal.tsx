'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { api } from '../../lib/api-client';
import { useToast } from '../ui/Toast';

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: any | null;
  parentCategoryId?: string | null;
  categoriesList: any[];
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
  parentCategoryId,
  categoriesList = [],
}) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('');
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (category) {
      setName(category.name || '');
      setCode(category.code || '');
      setParentId(category.parentId || '');
      setDefaultTaxRate(category.defaultTaxRate ?? 0);
      setDescription(category.description || '');
      setIsActive(category.isActive !== false);
    } else {
      setName('');
      setCode('');
      setParentId(parentCategoryId || '');
      setDefaultTaxRate(0);
      setDescription('');
      setIsActive(true);
    }
    setError('');
  }, [isOpen, category, parentCategoryId]);

  // Auto-generate slug when typing name (if code hasn't been manually set in create mode)
  const handleNameChange = (val: string) => {
    setName(val);
    if (!category) {
      const generatedCode = val
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .slice(0, 15);
      setCode(generatedCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      code: code.trim() ? code.trim().toUpperCase() : undefined,
      parentId: parentId || undefined,
      defaultTaxRate: Number(defaultTaxRate) || 0,
      description: description.trim() || undefined,
      isActive,
    };

    try {
      if (category) {
        await api.put(`/categories/${category.id || category._id}`, payload);
        toast.success(`Category "${name}" updated successfully.`);
      } else {
        await api.post('/categories', payload);
        toast.success(`Category "${name}" created successfully.`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  // Filter available parent categories (prevent self-selection)
  const parentOptions = [
    { value: '', label: 'None (Root Category)' },
    ...categoriesList
      .filter((c) => !category || (c.id !== category.id && c._id !== category._id))
      .map((c) => ({
        value: c.id || c._id,
        label: c.name,
      })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={category ? 'Edit Category' : 'Create Category'}
      subtitle="Define category hierarchy, codes, and tax rates"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <Input
          label="Category Name"
          placeholder="e.g. Beverages"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Category Code (Slug)"
            placeholder="e.g. BEVERAGES"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            helperText="Uppercase alphanumeric slug"
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Default VAT Rate (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
              className="w-full h-10 px-3.5 bg-slate-900 text-slate-100 text-sm rounded-lg border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <Select
          label="Parent Category"
          options={parentOptions}
          value={parentId}
          onChange={(val) => setParentId(String(val))}
          placeholder="Select parent category"
          searchable
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Description
          </label>
          <input
            type="text"
            placeholder="Optional brief description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-10 px-3.5 bg-slate-900 text-slate-100 text-sm rounded-lg border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span>Active Category</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {category ? 'Update Category' : 'Save Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
