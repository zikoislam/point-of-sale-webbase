'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, RefreshCw, Check, Truck, PackageCheck, X, Phone } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { useToast } from '../../../../components/ui/Toast';
import { useAuth } from '../../../../hooks/useAuth';

interface OnlineOrder {
  _id: string;
  orderNo: string;
  customer: { name: string; phone: string; address: string };
  items: any[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  saleId?: any;
  trackingCode?: string;
  createdAt: string;
}

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(v || 0);

export default function EcommerceOrdersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const isSuper = !!user?.isPlatformSuperAdmin;
  const has = (p: string) => isSuper || perms.includes(p);
  const canManage = has('ecom:manage');

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<OnlineOrder[]>({
    queryKey: ['ecom-orders'],
    queryFn: async () => (await api.get('/ecommerce/orders')).data || [],
  });

  const confirm = useMutation({
    mutationFn: async (id: string) => { await api.post(`/ecommerce/orders/${id}/confirm`); },
    onSuccess: () => { toast.success('Order confirmed — sale created'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const ship = useMutation({
    mutationFn: async (id: string) => { await api.patch(`/ecommerce/orders/${id}/status`, { status: 'SHIPPED' }); },
    onSuccess: () => { toast.success('Marked as shipped'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deliver = useMutation({
    mutationFn: async (id: string) => { await api.patch(`/ecommerce/orders/${id}/status`, { status: 'DELIVERED' }); },
    onSuccess: () => { toast.success('Delivered — marked paid'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => { await api.patch(`/ecommerce/orders/${id}/status`, { status: 'CANCELLED' }); },
    onSuccess: () => { toast.success('Order cancelled'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ecom-orders'] });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Online Orders</h1>
            <p className="text-sm text-slate-400">Orders from your public storefront — confirm to create a sale</p>
          </div>
        </div>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw className={isRefetching ? 'animate-spin' : ''} />} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-10 text-center text-slate-500 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Order</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Items</th>
                  <th className="px-5 py-3 text-left">Total</th>
                  <th className="px-5 py-3 text-left">Payment</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-800/40 align-top">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{o.orderNo}</p>
                      <p className="text-[11px] text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-200">{o.customer.name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{o.customer.phone}</p>
                      <p className="text-[11px] text-slate-500 max-w-[180px] truncate">{o.customer.address}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {o.items.map((i, idx) => (
                        <p key={idx} className="text-[11px]">{i.productName} × {i.quantity}</p>
                      ))}
                    </td>
                    <td className="px-5 py-4 text-white font-semibold">{money(o.totalAmount)}</td>
                    <td className="px-5 py-4">
                      <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">{o.paymentStatus} · {o.paymentMethod}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={o.fulfillmentStatus === 'PENDING' ? 'warning' : o.fulfillmentStatus === 'DELIVERED' ? 'success' : o.fulfillmentStatus === 'CANCELLED' ? 'danger' : 'info'} size="sm">
                        {o.fulfillmentStatus}
                      </Badge>
                      {o.saleId?.invoiceNo && <p className="text-[11px] text-slate-500 mt-1">{o.saleId.invoiceNo}</p>}
                      {o.trackingCode && <p className="text-[11px] text-slate-500">Track: {o.trackingCode}</p>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canManage && o.fulfillmentStatus === 'PENDING' && (
                        <div className="inline-flex gap-1.5">
                          <Button variant="primary" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />} loading={confirm.isPending} onClick={() => confirm.mutate(o._id)}>
                            Confirm
                          </Button>
                          <button className="p-2 text-rose-400 hover:bg-slate-800 rounded-lg" title="Cancel" onClick={() => cancel.mutate(o._id)}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {canManage && o.fulfillmentStatus === 'CONFIRMED' && (
                        <Button variant="outline" size="sm" leftIcon={<Truck className="w-3.5 h-3.5" />} loading={ship.isPending} onClick={() => ship.mutate(o._id)}>
                          Ship
                        </Button>
                      )}
                      {canManage && o.fulfillmentStatus === 'SHIPPED' && (
                        <Button variant="success" size="sm" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} loading={deliver.isPending} onClick={() => deliver.mutate(o._id)}>
                          Delivered
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      No online orders yet. Mark products as web-visible and share your storefront link: <strong className="text-slate-300">/store/&lt;org-slug&gt;</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
