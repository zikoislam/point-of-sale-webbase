'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  DollarSign,
  Search,
  Filter,
  Layers,
  ArrowRight,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

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
  supplierId: { _id: string; companyName: string; phone: string };
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

interface SupplierOption {
  id: string;
  companyName: string;
}

interface VariantOption {
  variantId: string;
  productName: string;
  sku: string;
  attributeName: string;
  costPrice: number;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [productVariants, setProductVariants] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Create PO Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingPO, setSavingPO] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<
    { variantId: string; productName: string; sku: string; orderedQty: number; unitCost: number }[]
  >([]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');

  // Receive GRN Modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [targetPO, setTargetPO] = useState<PurchaseOrder | null>(null);
  const [grnItems, setGrnItems] = useState<
    {
      variantId: string;
      productName: string;
      sku: string;
      orderedQty: number;
      alreadyReceived: number;
      receivedQty: number;
      unitCost: number;
      batchNo: string;
      expiryDate: string;
    }[]
  >([]);
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paidNow, setPaidNow] = useState(0);
  const [grnSaving, setGrnSaving] = useState(false);
  const [grnError, setGrnError] = useState('');

  const fetchDropdowns = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${API}/suppliers?limit=100`, { headers: authHeader() }),
        fetch(`${API}/products?limit=100`, { headers: authHeader() }),
      ]);
      const [sJson, pJson] = await Promise.all([sRes.json(), pRes.json()]);
      if (sJson.success) {
        setSuppliers(sJson.data.data.map((s: any) => ({ id: s.id, companyName: s.companyName })));
      }
      if (pJson.success) {
        const variantsList: VariantOption[] = [];
        // fetch detail for each to get variants if needed, or list products
        const prods = pJson.data.products || [];
        for (const p of prods) {
          const detRes = await fetch(`${API}/products/${p.id}`, { headers: authHeader() });
          const detJson = await detRes.json();
          if (detJson.success && detJson.data.variants) {
            for (const v of detJson.data.variants) {
              variantsList.push({
                variantId: v._id,
                productName: detJson.data.name,
                sku: v.sku,
                attributeName: v.attributeName,
                costPrice: v.costPrice || 0,
              });
            }
          }
        }
        setProductVariants(variantsList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`${API}/purchase-orders?${params.toString()}`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) setOrders(j.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openCreatePO = () => {
    setSelectedSupplierId(suppliers[0]?.id || '');
    setPoItems([]);
    setTaxAmount(0);
    setShippingCost(0);
    setNotes('');
    setExpectedDate('');
    setCreateError('');
    setShowCreateModal(true);
  };

  const addPOItemRow = () => {
    if (productVariants.length === 0) return;
    const first = productVariants[0];
    setPoItems([
      ...poItems,
      {
        variantId: first.variantId,
        productName: `${first.productName} (${first.attributeName})`,
        sku: first.sku,
        orderedQty: 10,
        unitCost: first.costPrice || 10,
      },
    ]);
  };

  const updatePOItemRow = (idx: number, variantId: string) => {
    const found = productVariants.find((v) => v.variantId === variantId);
    if (!found) return;
    const updated = [...poItems];
    updated[idx] = {
      ...updated[idx],
      variantId: found.variantId,
      productName: `${found.productName} (${found.attributeName})`,
      sku: found.sku,
      unitCost: found.costPrice || updated[idx].unitCost,
    };
    setPoItems(updated);
  };

  const handleSavePO = async () => {
    if (!selectedSupplierId) {
      setCreateError('Please select a supplier');
      return;
    }
    if (poItems.length === 0) {
      setCreateError('Please add at least one line item');
      return;
    }

    setSavingPO(true);
    setCreateError('');

    try {
      const payload = {
        supplierId: selectedSupplierId,
        items: poItems.map((i) => ({
          variantId: i.variantId,
          productName: i.productName,
          sku: i.sku,
          orderedQty: Number(i.orderedQty),
          unitCost: Number(i.unitCost),
        })),
        taxAmount: Number(taxAmount) || 0,
        shippingCost: Number(shippingCost) || 0,
        expectedDeliveryDate: expectedDate || undefined,
        notes: notes || undefined,
      };

      const res = await fetch(`${API}/purchase-orders`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to create PO');

      setShowCreateModal(false);
      fetchOrders();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setSavingPO(false);
    }
  };

  const handleStatusChange = async (poId: string, status: 'ORDERED' | 'CANCELLED') => {
    if (!confirm(`Mark this PO as ${status}?`)) return;
    try {
      const res = await fetch(`${API}/purchase-orders/${poId}/status`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ status }),
      });
      const j = await res.json();
      if (j.success) fetchOrders();
      else alert(j.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openGRNModal = (po: PurchaseOrder) => {
    setTargetPO(po);
    setVendorInvoiceNo(po.vendorInvoiceNo || '');
    setPaidNow(0);
    setGrnError('');
    setGrnItems(
      po.items.map((i) => ({
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        orderedQty: i.orderedQty,
        alreadyReceived: i.receivedQty,
        receivedQty: Math.max(0, i.orderedQty - i.receivedQty),
        unitCost: i.unitCost,
        batchNo: `BATCH-${Date.now().toString().slice(-6)}`,
        expiryDate: '',
      }))
    );
    setShowGRNModal(true);
  };

  const handleReceiveGRN = async () => {
    if (!targetPO) return;
    setGrnSaving(true);
    setGrnError('');

    try {
      const payload = {
        vendorInvoiceNo: vendorInvoiceNo.trim() || undefined,
        paidNow: Number(paidNow) || 0,
        items: grnItems.map((i) => ({
          variantId: i.variantId,
          receivedQty: Number(i.receivedQty),
          unitCost: Number(i.unitCost),
          batchNo: i.batchNo.trim() || undefined,
          expiryDate: i.expiryDate || undefined,
        })),
      };

      const res = await fetch(`${API}/purchase-orders/${targetPO._id}/grn`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'GRN receiving failed');

      setShowGRNModal(false);
      fetchOrders();
    } catch (e: any) {
      setGrnError(e.message);
    } finally {
      setGrnSaving(false);
    }
  };

  const poSubtotal = poItems.reduce((acc, item) => acc + item.orderedQty * item.unitCost, 0);
  const poTotal = poSubtotal + Number(taxAmount || 0) + Number(shippingCost || 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Purchase Orders & GRN</h1>
            <p className="text-sm text-slate-400">
              Procurement orders, Goods Received Notes & Weighted Average Cost (WAC) tracking
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchOrders()}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreatePO}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        {['', 'DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap ${
              statusFilter === s
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s ? s : 'All Orders'}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-center">Items</th>
                <th className="py-3.5 px-4 text-right">Total Amount</th>
                <th className="py-3.5 px-4 text-right">Paid / Due</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders found matching filter.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{po.poNumber}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">
                        {po.supplierId?.companyName || 'Unknown Vendor'}
                      </div>
                      <div className="text-xs text-slate-400">{po.supplierId?.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {po.items?.length || 0} line items
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-white">
                      ৳{po.totalAmount?.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs">
                      <div className="text-emerald-400">Paid: ৳{po.paidAmount?.toFixed(2)}</div>
                      <div className={po.dueAmount > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                        Due: ৳{po.dueAmount?.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          po.status === 'RECEIVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : po.status === 'PARTIAL'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : po.status === 'ORDERED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : po.status === 'CANCELLED'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {po.status === 'DRAFT' && (
                          <button
                            onClick={() => handleStatusChange(po._id, 'ORDERED')}
                            className="px-2.5 py-1 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-600/30 transition"
                          >
                            Send Order
                          </button>
                        )}
                        {(po.status === 'ORDERED' || po.status === 'PARTIAL') && (
                          <button
                            onClick={() => openGRNModal(po)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition flex items-center space-x-1"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Receive GRN</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white">Create Purchase Order</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Select Vendor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Procurement Items</h3>
                  <button
                    type="button"
                    onClick={addPOItemRow}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:bg-violet-600/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {poItems.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                    No items added yet. Click "Add Item" to add product variants to this order.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {poItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl grid grid-cols-12 gap-3 items-center"
                      >
                        <div className="col-span-5">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Product</label>
                          <select
                            value={item.variantId}
                            onChange={(e) => updatePOItemRow(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                          >
                            {productVariants.map((pv) => (
                              <option key={pv.variantId} value={pv.variantId}>
                                {pv.productName} ({pv.attributeName}) [{pv.sku}]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Order Qty</label>
                          <input
                            type="number"
                            value={item.orderedQty}
                            onChange={(e) => {
                              const updated = [...poItems];
                              updated[idx].orderedQty = Number(e.target.value);
                              setPoItems(updated);
                            }}
                            min={1}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Unit Cost (৳)</label>
                          <input
                            type="number"
                            value={item.unitCost}
                            onChange={(e) => {
                              const updated = [...poItems];
                              updated[idx].unitCost = Number(e.target.value);
                              setPoItems(updated);
                            }}
                            min={0}
                            step="0.01"
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                          />
                        </div>

                        <div className="col-span-1 text-right pt-3">
                          <button
                            type="button"
                            onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Calculation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Notes / Instructions</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Delivery terms, batch requirements, etc."
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span>৳{poSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Tax Amount:</span>
                    <input
                      type="number"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                    />
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Shipping Cost:</span>
                    <input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                    />
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-bold text-white">
                    <span>Total Cost:</span>
                    <span className="text-violet-400">৳{poTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePO}
                disabled={savingPO}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-violet-600/20"
              >
                {savingPO ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{savingPO ? 'Creating...' : 'Create Purchase Order'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive GRN Modal */}
      {showGRNModal && targetPO && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Receive Goods (GRN Receiving)</h2>
                <p className="text-xs text-slate-400">
                  PO #{targetPO.poNumber} • Auto calculates Weighted Average Cost (WAC) & updates inventory
                </p>
              </div>
              <button
                onClick={() => setShowGRNModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
              {grnError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                  {grnError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vendor Invoice / Challan No
                  </label>
                  <input
                    type="text"
                    value={vendorInvoiceNo}
                    onChange={(e) => setVendorInvoiceNo(e.target.value)}
                    placeholder="INV-99238"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Payment Disbursed Now (৳)
                  </label>
                  <input
                    type="number"
                    value={paidNow}
                    onChange={(e) => setPaidNow(Number(e.target.value))}
                    min={0}
                    step="0.01"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400">Receiving Checklist</h3>
                {grnItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-white">
                        {item.productName} <span className="text-slate-400">[{item.sku}]</span>
                      </div>
                      <div className="text-slate-400">
                        Ordered: {item.orderedQty} | Received: {item.alreadyReceived}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-emerald-400 font-semibold mb-0.5">
                          Receive Qty Now *
                        </label>
                        <input
                          type="number"
                          value={item.receivedQty}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].receivedQty = Number(e.target.value);
                            setGrnItems(updated);
                          }}
                          min={0}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/50 rounded-lg text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Unit Cost (৳)</label>
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].unitCost = Number(e.target.value);
                            setGrnItems(updated);
                          }}
                          min={0}
                          step="0.01"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Batch / Lot #</label>
                        <input
                          type="text"
                          value={item.batchNo}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].batchNo = e.target.value;
                            setGrnItems(updated);
                          }}
                          placeholder="e.g. BATCH-01"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Expiry Date</label>
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].expiryDate = e.target.value;
                            setGrnItems(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowGRNModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReceiveGRN}
                disabled={grnSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
              >
                {grnSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{grnSaving ? 'Processing GRN...' : 'Confirm Goods Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
