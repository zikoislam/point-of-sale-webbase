'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { GRNModal } from '@/components/modals/GRNModal';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  PackageCheck,
  Ban,
  Printer,
  Calendar,
  Building2,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Layers,
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

interface PurchaseOrderDetail {
  _id: string;
  poNumber: string;
  supplierId: {
    _id: string;
    companyName: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
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
  receivedById?: { name: string };
  notes?: string;
  createdAt: string;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = params?.id as string;

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPO = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/purchase-orders/${id}`);
      setPo(res.data);
    } catch (err: any) {
      toast.error('Error', err?.message || 'Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadPO();
    }
  }, [id]);

  const handleCancelPO = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/purchase-orders/${id}/status`, { status: 'CANCELLED' });
      toast.success('PO Cancelled', `Purchase Order ${po?.poNumber} has been cancelled`);
      loadPO();
    } catch (err: any) {
      toast.error('Action Failed', err?.message || 'Failed to cancel PO');
    } finally {
      setActionLoading(false);
      setShowCancelDialog(false);
    }
  };

  const handleMarkOrdered = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/purchase-orders/${id}/status`, { status: 'ORDERED' });
      toast.success('PO Ordered', `Purchase Order marked as ORDERED`);
      loadPO();
    } catch (err: any) {
      toast.error('Action Failed', err?.message || 'Failed to update PO status');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-100">Purchase Order Not Found</h2>
        <Button variant="ghost" onClick={() => router.push('/purchase-orders')}>
          Return to Orders
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral">DRAFT</Badge>;
      case 'ORDERED':
        return <Badge variant="info">ORDERED</Badge>;
      case 'PARTIAL':
        return <Badge variant="warning">PARTIAL RECEIVED</Badge>;
      case 'RECEIVED':
        return <Badge variant="success">RECEIVED</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const canReceive = po.status === 'ORDERED' || po.status === 'PARTIAL';
  const isDraft = po.status === 'DRAFT';
  const totalOrderedQty = po.items.reduce((sum, item) => sum + item.orderedQty, 0);
  const totalReceivedQty = po.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
  const overallProgressPercent = totalOrderedQty > 0
    ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100))
    : 0;

  return (
    <div className="space-y-6 pb-12 print:space-y-4 print:pb-0">
      {/* Action Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/purchase-orders')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Orders
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {po.poNumber}
              </h1>
              {getStatusBadge(po.status)}
            </div>
            <p className="text-sm text-slate-400">
              Created on {formatDate(po.createdAt)}
              {po.createdById?.name && ` by ${po.createdById.name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print PO
          </Button>

          {isDraft && (
            <Button
              variant="primary"
              onClick={handleMarkOrdered}
              isLoading={actionLoading}
            >
              Mark as Ordered
            </Button>
          )}

          {canReceive && (
            <Button
              variant="primary"
              onClick={() => setShowGRNModal(true)}
              leftIcon={<PackageCheck className="w-4 h-4" />}
            >
              Receive Goods (GRN)
            </Button>
          )}

          {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
            <Button
              variant="danger"
              onClick={() => setShowCancelDialog(true)}
              leftIcon={<Ban className="w-4 h-4" />}
            >
              Cancel PO
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card if Receiving */}
      {(po.status === 'ORDERED' || po.status === 'PARTIAL' || po.status === 'RECEIVED') && (
        <Card className="print:hidden border-slate-800 bg-slate-900/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Fulfillment & Receiving Progress
                </span>
              </div>
              <span className="text-sm font-mono font-bold text-blue-400">
                {totalReceivedQty} / {totalOrderedQty} Units ({overallProgressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  overallProgressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Printable PO Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Supplier Info */}
        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2 text-slate-200">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Supplier Information</span>
              </div>
            }
          />
          <CardContent className="space-y-2 text-sm">
            <p className="font-bold text-base text-slate-100">
              {po.supplierId?.companyName || 'N/A'}
            </p>
            {po.supplierId?.contactPerson && (
              <p className="text-slate-300 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {po.supplierId.contactPerson}
              </p>
            )}
            {po.supplierId?.phone && (
              <p className="text-slate-300 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                {po.supplierId.phone}
              </p>
            )}
            {po.supplierId?.email && (
              <p className="text-slate-300 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {po.supplierId.email}
              </p>
            )}
          </CardContent>
        </Card>

        {/* PO Timeline & Status */}
        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2 text-slate-200">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Order Timeline</span>
              </div>
            }
          />
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Order Date:</span>
              <span className="text-slate-200">{formatDate(po.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expected Delivery:</span>
              <span className="text-slate-200">
                {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Not Specified'}
              </span>
            </div>
            {po.actualReceivedDate && (
              <div className="flex justify-between">
                <span className="text-slate-400">Received Date:</span>
                <span className="text-emerald-400 font-medium">
                  {formatDate(po.actualReceivedDate)}
                </span>
              </div>
            )}
            {po.vendorInvoiceNo && (
              <div className="flex justify-between">
                <span className="text-slate-400">Vendor Inv #:</span>
                <span className="font-mono text-slate-200">{po.vendorInvoiceNo}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2 text-slate-200">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span>Financial & Payment Status</span>
              </div>
            }
          />
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total PO Amount:</span>
              <span className="font-bold text-slate-100">{formatCurrency(po.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Disbursed / Paid:</span>
              <span className="font-medium text-emerald-400">
                {formatCurrency(po.paidAmount || 0)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-400 font-medium">Due Balance:</span>
              <span className="font-bold text-rose-400">
                {formatCurrency(po.dueAmount || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center justify-between w-full">
              <span className="text-slate-200 font-semibold">Ordered Line Items</span>
              <span className="text-xs text-slate-400">{po.items.length} items</span>
            </div>
          }
        />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">SKU</th>
                  <th className="p-3.5 text-center">Ordered</th>
                  <th className="p-3.5 text-center">Received</th>
                  <th className="p-3.5 text-center">Remaining</th>
                  <th className="p-3.5 w-44">Receiving Progress</th>
                  <th className="p-3.5 text-right">Unit Cost</th>
                  <th className="p-3.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {po.items.map((item, idx) => {
                  const rem = Math.max(0, item.orderedQty - (item.receivedQty || 0));
                  const percent = item.orderedQty > 0
                    ? Math.min(100, Math.round(((item.receivedQty || 0) / item.orderedQty) * 100))
                    : 0;

                  return (
                    <tr key={item.variantId || idx} className="hover:bg-slate-850/40">
                      <td className="p-3.5 font-medium text-slate-200">
                        {item.productName}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-400">
                        {item.sku}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-200">
                        {item.orderedQty}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-emerald-400">
                        {item.receivedQty || 0}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-amber-400">
                        {rem}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-400 w-9 text-right">
                            {percent}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right text-slate-300">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-slate-100">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900/50 border-t border-slate-800 text-sm">
                <tr>
                  <td colSpan={7} className="p-3 text-right text-slate-400">
                    Subtotal:
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-200">
                    {formatCurrency(po.subtotal)}
                  </td>
                </tr>
                {po.taxAmount > 0 && (
                  <tr>
                    <td colSpan={7} className="p-2 text-right text-slate-400">
                      Tax:
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {formatCurrency(po.taxAmount)}
                    </td>
                  </tr>
                )}
                {po.shippingCost > 0 && (
                  <tr>
                    <td colSpan={7} className="p-2 text-right text-slate-400">
                      Shipping / Freight:
                    </td>
                    <td className="p-2 text-right text-slate-300">
                      {formatCurrency(po.shippingCost)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-slate-800 text-base">
                  <td colSpan={7} className="p-3 text-right font-bold text-slate-100">
                    Grand Total:
                  </td>
                  <td className="p-3 text-right font-bold text-blue-400">
                    {formatCurrency(po.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Order Notes */}
      {po.notes && (
        <Card>
          <CardHeader title="Order Instructions & Notes" />
          <CardContent>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* GRN Modal */}
      <GRNModal
        isOpen={showGRNModal}
        onClose={() => setShowGRNModal(false)}
        onSuccess={loadPO}
        po={po}
      />

      {/* Confirm Cancel PO Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelPO}
        title="Cancel Purchase Order"
        description={`Are you sure you want to cancel Purchase Order ${po.poNumber}? This action cannot be reversed.`}
        confirmText="Yes, Cancel PO"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
