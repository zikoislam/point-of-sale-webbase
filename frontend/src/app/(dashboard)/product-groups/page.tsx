'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Package,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { DataTable, Column } from '../../../components/ui/DataTable';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';

interface ProductGroup {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  parentGroupId?: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

const groupId = (g: ProductGroup) => g._id || g.id || '';

const ProductGroupsPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('list');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductGroup | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; parentGroupId: string; isActive: boolean }>({
    name: '',
    description: '',
    parentGroupId: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery<ProductGroup[]>({
    queryKey: ['product-groups'],
    queryFn: async () => {
      const res = await api.get('/product-groups');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // ── search + status filter ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(
      (g) => (!q || g.name.toLowerCase().includes(q)) && (showInactive || g.isActive)
    );
  }, [groups, search, showInactive]);

  // ── parent/child tree ─────────────────────────────────────────────────────
  const childrenOf = useMemo(() => {
    const map: Record<string, ProductGroup[]> = {};
    for (const g of filtered) {
      const parent = g.parentGroupId ? String(g.parentGroupId) : 'ROOT';
      if (!map[parent]) map[parent] = [];
      map[parent].push(g);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [filtered]);

  // Descendants of the group being edited — cannot be its parent
  const blockedParents = useMemo(() => {
    const blocked = new Set<string>();
    if (!editing) return blocked;
    const walk = (parentId: string) => {
      for (const child of childrenOf[parentId] || []) {
        blocked.add(groupId(child));
        walk(groupId(child));
      }
    };
    blocked.add(groupId(editing));
    walk(groupId(editing));
    return blocked;
  }, [editing, childrenOf]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', parentGroupId: '', isActive: true });
    setModalOpen(true);
  };

  const openEdit = (group: ProductGroup) => {
    setEditing(group);
    setForm({
      name: group.name,
      description: group.description || '',
      parentGroupId: group.parentGroupId ? String(group.parentGroupId) : '',
      isActive: group.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        parentGroupId: form.parentGroupId || '',
        isActive: form.isActive,
      };
      if (editing) {
        await api.put(`/product-groups/${groupId(editing)}`, payload);
        toast.success('Product group updated');
      } else {
        await api.post('/product-groups', payload);
        toast.success('Product group created');
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/product-groups/${groupId(deleteTarget)}`);
      toast.success('Product group deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['product-groups'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<ProductGroup>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => {
        const parent = groups.find((g) => groupId(g) === String(row.parentGroupId));
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-fuchsia-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{row.name}</p>
              {parent && <p className="text-[11px] text-slate-500">in {parent.name}</p>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-slate-400 text-xs">{row.description || <span className="text-slate-600">—</span>}</span>
      ),
    },
    {
      key: 'productCount',
      header: 'Products',
      sortable: true,
      align: 'right',
      render: (row) => (
        <Badge variant={row.productCount > 0 ? 'purple' : 'neutral'} size="sm">
          <Package className="w-3 h-3 mr-1 inline" />
          {row.productCount}
        </Badge>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'danger'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1.5">
          <button
            className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"
            title="Edit"
            onClick={() => openEdit(row)}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
            title="Delete"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── tree renderer ─────────────────────────────────────────────────────────
  const renderTree = (parentKey: string, depth: number): React.ReactNode => {
    const nodes = childrenOf[parentKey] || [];
    if (nodes.length === 0) return null;
    return (
      <div className={depth > 0 ? 'pl-5 border-l border-slate-800 ml-2' : ''}>
        {nodes.map((node) => {
          const id = groupId(node);
          const kids = childrenOf[id] || [];
          const isOpen = expanded[id] ?? depth === 0;
          return (
            <div key={id}>
              <div
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-800/50 transition-colors group"
                style={{ marginLeft: depth * 2 }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [id]: !isOpen }))}
                  className={`p-0.5 rounded ${kids.length ? 'text-slate-400 hover:text-white' : 'invisible'}`}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <Layers className={`w-4 h-4 shrink-0 ${depth === 0 ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                <span className={`text-sm truncate ${depth === 0 ? 'font-semibold text-white' : 'text-slate-300'}`}>
                  {node.name}
                </span>
                {!node.isActive && <Badge variant="danger" size="sm">Inactive</Badge>}
                <Badge variant="neutral" size="sm">{node.productCount} products</Badge>
                <span className="flex-1" />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"
                    title="Edit"
                    onClick={() => openEdit(node)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                    title="Delete"
                    onClick={() => setDeleteTarget(node)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isOpen && kids.length > 0 && renderTree(id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Product Groups</h1>
            <p className="text-sm text-slate-400">
              Organise products into groups and sub-groups — nest them as deep as you need
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={openCreate}>
            New Group
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <Tabs
          tabs={[
            { key: 'list', label: 'All Groups', count: filtered.length, icon: <Layers className="w-3.5 h-3.5" /> },
            { key: 'tree', label: 'Tree View', icon: <FolderTree className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
        />

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups…"
              className="w-full sm:w-60 pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
            <input
              type="checkbox"
              className="accent-emerald-500"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </div>

      {/* Flat list */}
      {activeTab === 'list' && (
        <DataTable<ProductGroup>
          columns={columns}
          data={filtered}
          keyExtractor={(row) => groupId(row)}
          loading={isLoading}
          emptyMessage={search ? 'No groups match your search.' : 'No product groups yet — create the first one.'}
          emptyIcon={<Layers className="w-10 h-10 text-slate-700 mb-1" />}
          rowClassName={(row) => (row.isActive ? '' : 'opacity-60')}
        />
      )}

      {/* Tree */}
      {activeTab === 'tree' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-slate-500 text-sm">
              {search ? 'No groups match your search.' : 'No product groups yet.'}
            </p>
          ) : (
            renderTree('ROOT', 0)
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product Group' : 'New Product Group'}
        subtitle={editing ? editing.name : 'Groups can be nested as sub-groups'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Group name *
            </label>
            <Input
              value={form.name}
              onChange={(e: any) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Electronics, Grocery, Winter Collection"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional note about this group"
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Parent group (for sub-groups)
            </label>
            <select
              value={form.parentGroupId}
              onChange={(e) => setForm({ ...form, parentGroupId: e.target.value })}
              className="w-full h-10 px-3.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">None — top-level group</option>
              {groups
                .filter((g) => !blockedParents.has(groupId(g)))
                .map((g) => (
                  <option key={groupId(g)} value={groupId(g)}>
                    {g.parentGroupId ? '— ' : ''}
                    {g.name}
                  </option>
                ))}
            </select>
            {editing && (
              <p className="text-[11px] text-slate-500 mt-1">
                A group cannot be moved under itself or one of its own sub-groups.
              </p>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              className="accent-emerald-500"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editing ? 'Save Changes' : 'Create Group'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product Group"
        description={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? Sub-groups will become top-level and the
            group will be removed from {deleteTarget?.productCount || 0} product(s). This cannot be undone.
          </>
        }
        confirmText="Delete Group"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};

export default ProductGroupsPage;
