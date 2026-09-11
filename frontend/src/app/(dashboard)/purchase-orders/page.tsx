'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GRNModal } from '@/components/modals/GRNModal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FileSpreadsheet,
  Plus,
  Eye,
  Edit,
  PackageCheck,
} from 'lucide-react';

interface POItem {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: {
    _id: string;
    companyName: string;
    phone?: string;
  };
  status: 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  items: POItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  expectedDeliveryDate?: string;
  actualReceivedDate?: string;
  vendorInvoiceNo?: string;
  createdById?: { name: string };
  createdAt: string;
}

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Ordered', value: 'ORDERED' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const toast = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // GRN Modal target
  const [targetGRNPO, setTargetGRNPO] = useState<PurchaseOrder | null>(null);
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);

  // Cancel PO dialog
  const [targetCancelPO, setTargetCancelPO] = useState<PurchaseOrder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit: 15,
      };
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/purchase-orders', { params });
      const data = res.data;

      if (data && Array.isArray(data.data)) {
        setOrders(data.data);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      } else if (Array.isArray(data)) {
        setOrders(data);
        setTotalPages(1);
        setTotalCount(data.length);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      toast.error('Fetch Error', err?.message || 'Failed to fetch purchase orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, selectedStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancel = async () => {
    if (!targetCancelPO) return;
    try {
      setIsCancelling(true);
      await api.patch(`/purchase-orders/${targetCancelPO._id}/status`, { status: 'CANCELLED' });
      toast.success('PO Cancelled', `Purchase order ${targetCancelPO.poNumber} cancelled.`);
      setTargetCancelPO(null);
      fetchOrders();
    } catch (err: any) {
      toast.error('Cancel Failed', err?.message || 'Failed to cancel PO');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral">Draft</Badge>;
      case 'ORDERED':
        return <Badge variant="info">Ordered</Badge>;
      case 'PARTIAL':
        return <Badge variant="warning">Partial</Badge>;
      case 'RECEIVED':
        return <Badge variant="success">Received</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const filteredOrders = orders.filter((po) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      po.poNumber?.toLowerCase().includes(q) ||
      po.supplierId?.companyName?.toLowerCase().includes(q) ||
      po.vendorInvoiceNo?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-blue-500" />
            Purchase Orders
          </h1>
          <p className="text-sm text-slate-400">
            Manage procurement cycles, vendor orders, and incoming Goods Received Notes (GRN)
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => router.push('/purchase-orders/new')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create PO
        </Button>
      </div>

      {/* Filter Tabs & Search Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {STATUS_TABS.map((tab) => {
                const isActive = selectedStatus === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setSelectedStatus(tab.value);
                      setPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* PO / Supplier Search */}
            <div className="w-full md:w-72">
              <SearchInput
                placeholder="Search PO # or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">PO Number</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5 text-center">Items</th>
                  <th className="p-3.5 text-right">Total Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Created Date</th>
                  <th className="p-3.5">Expected Delivery</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-300">
                        No purchase orders found
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchQuery
                          ? 'Try clearing the search query or changing the status filter.'
                          : 'Create your first purchase order to procure items from suppliers.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => {
                    const isDraft = po.status === 'DRAFT';
                    const canReceive = po.status === 'ORDERED' || po.status === 'PARTIAL';

                    return (
                      <tr
                        key={po._id}
                        className="hover:bg-slate-850/40 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/purchase-orders/${po._id}`)}
                      >
                        <td className="p-3.5 font-mono font-semibold text-blue-400">
                          {po.poNumber}
                        </td>
                        <td className="p-3.5 font-medium text-slate-200">
                          {po.supplierId?.companyName || 'Unknown Supplier'}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-300">
                          {po.items?.length || 0}
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-100">
                          {formatCurrency(po.totalAmount)}
                        </td>
                        <td className="p-3.5 text-center">
                          {getStatusBadge(po.status)}
                        </td>
                        <td className="p-3.5 text-slate-400 text-xs">
                          {formatDate(po.createdAt)}
                        </td>
                        <td className="p-3.5 text-slate-400 text-xs">
                          {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—'}
                        </td>
                        <td
                          className="p-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/purchase-orders/${po._id}`)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                            </Button>

                            {canReceive && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setTargetGRNPO(po);
                                  setIsGRNModalOpen(true);
                                }}
                                className="text-xs h-7 px-2.5 text-emerald-400 hover:text-emerald-300"
                              >
                                <PackageCheck className="w-3.5 h-3.5 mr-1" />
                                Receive
                              </Button>
                            )}

                            {isDraft && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/purchase-orders/${po._id}`)}
                                title="Edit Draft"
                              >
                                <Edit className="w-4 h-4 text-blue-400" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* GRN Modal */}
      <GRNModal
        isOpen={isGRNModalOpen}
        onClose={() => {
          setIsGRNModalOpen(false);
          setTargetGRNPO(null);
        }}
        onSuccess={fetchOrders}
        po={targetGRNPO}
      />

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={Boolean(targetCancelPO)}
        onClose={() => setTargetCancelPO(null)}
        onConfirm={handleCancel}
        title="Cancel Purchase Order"
        description={`Are you sure you want to cancel PO ${targetCancelPO?.poNumber}?`}
        confirmText="Yes, Cancel"
        variant="danger"
        loading={isCancelling}
      />
    </div>
  );
}
