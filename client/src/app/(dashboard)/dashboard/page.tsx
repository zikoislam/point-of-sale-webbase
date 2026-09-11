'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity,
  Boxes,
  Truck,
  Wallet,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface DashboardData {
  today: { revenue: number; orders: number };
  month: { revenue: number; orders: number };
  kpis: {
    customerDues: number;
    supplierPayables: number;
    liquidCapital: number;
    inventoryValuation: number;
    lowStockItems: number;
    totalCustomers: number;
    activeRegisterShifts: number;
  };
  recentSales: {
    id: string;
    invoiceNo: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    itemsCount: number;
    createdAt: string;
  }[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports/dashboard`, { headers: authHeader() });
      const j = await res.json();
      if (j.success && j.data) {
        setData(j.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600/20 via-violet-600/10 to-transparent border border-indigo-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/30">
            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Welcome back, {user?.fullName?.split(' ')[0] || 'User'}! 👋
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Live real-time store performance & business analytics
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={fetchDashboard}
              className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sales</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg text-white">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">
            ৳{data?.today.revenue ? data.today.revenue.toFixed(2) : '0.00'}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400 font-semibold">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{data?.today.orders || 0} bills finalized today</span>
          </div>
        </div>

        {/* Card 2: This Month's Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Revenue</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">
            ৳{data?.month.revenue ? data.month.revenue.toFixed(2) : '0.00'}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-indigo-400 font-semibold">
            <span>{data?.month.orders || 0} transactions this month</span>
          </div>
        </div>

        {/* Card 3: Combined Liquidity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Liquid Capital</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center shadow-lg text-white">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">
            ৳{data?.kpis.liquidCapital ? data.kpis.liquidCapital.toFixed(2) : '0.00'}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-teal-400 font-semibold">
            <span>Cash, Bank & Mobile Wallets</span>
          </div>
        </div>

        {/* Card 4: Inventory Valuation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inventory Asset Value</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center shadow-lg text-white">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">
            ৳{data?.kpis.inventoryValuation ? data.kpis.inventoryValuation.toFixed(2) : '0.00'}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{data?.kpis.lowStockItems || 0} low stock items</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold">Customer Dues (Receivables)</div>
            <div className="text-lg font-black text-rose-400 mt-0.5">
              ৳{data?.kpis.customerDues ? data.kpis.customerDues.toFixed(2) : '0.00'}
            </div>
          </div>
          <Link
            href="/customers"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
          >
            Collect
          </Link>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold">Vendor Accounts Payable</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              ৳{data?.kpis.supplierPayables ? data.kpis.supplierPayables.toFixed(2) : '0.00'}
            </div>
          </div>
          <Link
            href="/suppliers"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
          >
            Manage
          </Link>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold">Active Register Shifts</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {data?.kpis.activeRegisterShifts || 0} Counters Open
            </div>
          </div>
          <Link
            href="/shifts"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
          >
            View Shifts
          </Link>
        </div>
      </div>

      {/* Bottom Grid: Recent Sales & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span>Recent Sales Activity</span>
            </h2>
            <Link
              href="/sales"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/80">
            {data?.recentSales && data.recentSales.length > 0 ? (
              data.recentSales.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{s.invoiceNo}</div>
                    <div className="text-slate-500 mt-0.5">
                      {new Date(s.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {s.itemsCount} items
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-400 text-sm">
                      ৳{s.totalAmount.toFixed(2)}
                    </div>
                    {s.dueAmount > 0 && (
                      <div className="text-rose-400 font-bold">Due: ৳{s.dueAmount.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-slate-500 text-xs">No recent transactions recorded.</p>
            )}
          </div>
        </div>

        {/* Best Selling Products */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>Top Selling Products This Month</span>
            </h2>
            <Link
              href="/reports"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1"
            >
              <span>Full Report</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {data?.topProducts && data.topProducts.length > 0 ? (
              data.topProducts.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-white">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-200">{p.qty} units</span>
                    <div className="text-emerald-400 font-semibold mt-0.5">
                      ৳{p.revenue.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-slate-500 text-xs">No sales volume this month yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
