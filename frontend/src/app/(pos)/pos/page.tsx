'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Scan,
  Search,
  ShoppingCart,
  Trash2,
  PauseCircle,
  PlayCircle,
  Lock,
  Unlock,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  Plus,
  Minus,
  Check,
  X,
  Printer,
  ChevronRight,
  Layers,
  Sparkles,
  AlertCircle,
  Maximize,
  Minimize,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudUpload,
} from 'lucide-react';
import { usePOSHotkeys } from '../../../hooks/usePOSHotkeys';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { queueOfflineSale } from '../../../lib/offline-queue';
import { EscposBuilder } from '../../../lib/escpos-builder';
import { openCashDrawer } from '../../../lib/cash-drawer';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pos_access_token') : ''}`,
  'Content-Type': 'application/json',
});

interface Variant {
  _id: string;
  sku: string;
  barcode?: string;
  attributeName: string;
  costPrice: number;
  retailSellingPrice: number;
  wholesaleSellingPrice: number;
  currentStock: number;
  alertQty: number;
}

interface Product {
  id: string;
  name: string;
  categoryName?: string;
  categoryId: string;
  unit: string;
  taxType: string;
  taxRate: number;
  variants: Variant[];
}

interface CartItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitSellingPrice: number;
  taxRate: number;
  discount: number;
  stockAvailable: number;
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
  creditLimit: number;
  currentDueBalance: number;
}

interface Shift {
  _id: string;
  terminalId: string;
  openedAt: string;
  openingFloat: number;
  cashSalesTotal: number;
  expectedCash: number;
  status: string;
}

interface HoldCartItem {
  _id: string;
  cartLabel: string;
  totalAmount: number;
  items: any[];
  createdAt: string;
}

export default function POSTerminalPage() {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pricingTier, setPricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Hold Carts
  const [holdCarts, setHoldCarts] = useState<HoldCartItem[]>([]);
  const [showHoldModal, setShowHoldModal] = useState(false);

  // Modals & Panels
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  // Checkout Payment states
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD' | 'CUSTOMER_DUE'
  >('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // PIN Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Offline Sync Management
  const { isOnline, pendingCount, isSyncing, triggerSync, refreshPendingCount } = useOfflineSync(
    API,
    authHeader
  );

  // 1. Fetch Shift
  const fetchActiveShift = useCallback(async () => {
    try {
      const res = await fetch(`${API}/shifts/active`, { headers: authHeader() });
      const j = await res.json();
      if (j.success && j.data) {
        setActiveShift(j.data);
      } else {
        setActiveShift(null);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingShift(false);
    }
  }, []);

  // 2. Fetch Catalog
  const fetchCatalog = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API}/categories`, { headers: authHeader() }),
        fetch(`${API}/products?limit=100`, { headers: authHeader() }),
      ]);
      const [cJson, pJson] = await Promise.all([cRes.json(), pRes.json()]);
      if (cJson.success) setCategories(cJson.data);

      if (pJson.success) {
        const fullProducts: Product[] = [];
        for (const p of pJson.data.products || []) {
          const det = await fetch(`${API}/products/${p.id}`, { headers: authHeader() });
          const dj = await det.json();
          if (dj.success && dj.data) {
            fullProducts.push(dj.data);
          }
        }
        setProducts(fullProducts);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 3. Fetch Customers & Hold Carts
  const fetchAux = useCallback(async () => {
    try {
      const [custRes, holdRes] = await Promise.all([
        fetch(`${API}/customers`, { headers: authHeader() }),
        fetch(`${API}/sales/hold-carts`, { headers: authHeader() }),
      ]);
      const [custJson, holdJson] = await Promise.all([custRes.json(), holdRes.json()]);
      if (custJson.success) setCustomers(custJson.data || []);
      if (holdJson.success) setHoldCarts(holdJson.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchActiveShift();
    fetchCatalog();
    fetchAux();
  }, [fetchActiveShift, fetchCatalog, fetchAux]);

  // Focus barcode input
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [cart, isLocked]);

  // Add Item to Cart
  const addToCart = (product: Product, variant: Variant) => {
    if (variant.currentStock <= 0) {
      alert(`"${product.name} (${variant.attributeName})" is OUT OF STOCK!`);
      return;
    }

    const price =
      pricingTier === 'WHOLESALE'
        ? variant.wholesaleSellingPrice || variant.retailSellingPrice
        : variant.retailSellingPrice;

    setCart((prev) => {
      const existing = prev.find((item) => item.variantId === variant._id);
      if (existing) {
        if (existing.quantity >= variant.currentStock) {
          alert(`Cannot add more. Max stock available: ${variant.currentStock}`);
          return prev;
        }
        return prev.map((item) =>
          item.variantId === variant._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            variantId: variant._id,
            productName: product.name,
            variantName: variant.attributeName,
            sku: variant.sku,
            barcode: variant.barcode,
            quantity: 1,
            unitSellingPrice: price,
            taxRate: product.taxRate || 0,
            discount: 0,
            stockAvailable: variant.currentStock,
          },
        ];
      }
    });
  };

  // Barcode enter lookup
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const term = searchQuery.trim().toLowerCase();
    let found = false;

    for (const p of products) {
      for (const v of p.variants) {
        if (
          v.barcode?.toLowerCase() === term ||
          v.sku?.toLowerCase() === term ||
          p.name.toLowerCase() === term
        ) {
          addToCart(p, v);
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      alert(`No product found with barcode/SKU "${searchQuery}"`);
    }
    setSearchQuery('');
  };

  const updateCartQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variantId === variantId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.stockAvailable) {
              alert(`Max available stock is ${item.stockAvailable}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitSellingPrice, 0);
  const totalTax = cart.reduce(
    (acc, item) => acc + (item.quantity * item.unitSellingPrice * item.taxRate) / 100,
    0
  );
  const grandTotal = Math.max(0, subtotal + totalTax - overallDiscount);

  // Hold Cart
  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    const label = prompt('Enter a label for this held cart (e.g. Customer Name):') || 'Parked Cart';
    try {
      const res = await fetch(`${API}/sales/hold-cart`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          cartLabel: label,
          customerId: selectedCustomer?._id,
          pricingTier,
          items: cart.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitSellingPrice: i.unitSellingPrice,
          })),
          discountAmount: overallDiscount,
        }),
      });
      const j = await res.json();
      if (j.success) {
        setCart([]);
        setSelectedCustomer(null);
        setOverallDiscount(0);
        fetchAux();
      } else {
        alert(j.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Resume Cart
  const handleResumeCart = async (cartId: string) => {
    try {
      const res = await fetch(`${API}/sales/hold-cart/${cartId}/resume`, {
        method: 'POST',
        headers: authHeader(),
      });
      const j = await res.json();
      if (j.success) {
        const hc = j.data;
        setCart(
          hc.items.map((i: any) => ({
            variantId: i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            sku: i.sku,
            barcode: i.barcode,
            quantity: i.quantity,
            unitSellingPrice: i.unitSellingPrice,
            taxRate: i.taxRate || 0,
            discount: i.discount || 0,
            stockAvailable: 999, // default
          }))
        );
        setPricingTier(hc.pricingTier || 'RETAIL');
        setOverallDiscount(hc.discountAmount || 0);
        setShowHoldModal(false);
        fetchAux();
      } else {
        alert(j.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Open Checkout
  const openCheckout = useCallback(() => {
    if (cart.length === 0) {
      return;
    }
    setCashTendered(grandTotal);
    setPaymentMethod('CASH');
    setCheckoutError('');
    setShowCheckoutModal(true);
  }, [cart.length, grandTotal]);

  // Execute Checkout
  const handleCheckoutSubmit = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');

    const changeReturned =
      paymentMethod === 'CASH' ? Math.max(0, cashTendered - grandTotal) : 0;

    const payload = {
      customerId: selectedCustomer?._id || undefined,
      pricingTier,
      items: cart.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        unitSellingPrice: i.unitSellingPrice,
        taxRate: i.taxRate,
        discount: i.discount,
      })),
      discountAmount: overallDiscount,
      payments: [
        {
          method: paymentMethod,
          amount: paymentMethod === 'CASH' ? Math.min(cashTendered, grandTotal) : grandTotal,
        },
      ],
      changeReturned,
      idempotencyKey: `POS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };

    // If Offline: Queue to IndexedDB
    if (!navigator.onLine) {
      try {
        await queueOfflineSale(payload);
        await refreshPendingCount();

        // Synthetic completed sale for immediate thermal receipt
        const syntheticSale = {
          invoiceNo: `OFF-${Date.now().toString().slice(-6)}`,
          createdAt: new Date().toISOString(),
          items: cart.map((i) => ({ ...i, lineTotal: i.quantity * i.unitSellingPrice })),
          subtotal,
          totalTax,
          discountAmount: overallDiscount,
          totalAmount: grandTotal,
          paidAmount: paymentMethod === 'CASH' ? Math.min(cashTendered, grandTotal) : grandTotal,
          changeReturned,
          payments: [{ method: paymentMethod, amount: grandTotal }],
        };

        setCompletedSale(syntheticSale);
        setShowCheckoutModal(false);
        setShowReceiptModal(true);
        setCart([]);
        setSelectedCustomer(null);
        setOverallDiscount(0);
        openCashDrawer();
      } catch (err: any) {
        setCheckoutError(`Offline Queue Error: ${err.message}`);
      } finally {
        setCheckoutLoading(false);
      }
      return;
    }

    // If Online: Normal API checkout
    try {
      const res = await fetch(`${API}/sales/checkout`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Checkout failed');

      setCompletedSale(j.data);
      setShowCheckoutModal(false);
      setShowReceiptModal(true);

      // Trigger cash drawer kick on cash checkout
      if (paymentMethod === 'CASH') {
        openCashDrawer();
      }

      // Reset cart
      setCart([]);
      setSelectedCustomer(null);
      setOverallDiscount(0);

      // Refresh stock & shift cash
      fetchCatalog();
      fetchActiveShift();
    } catch (e: any) {
      setCheckoutError(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Bind Keyboard Hotkeys Hook (F2, F4, F8, F9, Ctrl+L, Escape, Enter)
  usePOSHotkeys({
    onFocusBarcode: () => barcodeInputRef.current?.focus(),
    onHoldCart: handleHoldCart,
    onOpenHeldCarts: () => setShowHoldModal(true),
    onFocusCustomer: () => {
      const el = document.getElementById('customer-select');
      el?.focus();
    },
    onOpenPaymentModal: openCheckout,
    onLockTerminal: () => setIsLocked(true),
    onCloseModals: () => {
      setShowCheckoutModal(false);
      setShowReceiptModal(false);
      setShowHoldModal(false);
    },
    onConfirmPayment: handleCheckoutSubmit,
    isPaymentModalOpen: showCheckoutModal,
  });

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants.some(
        (v) =>
          v.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCat && matchesSearch;
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-white tracking-wide">
              {activeShift ? activeShift.terminalId : 'NO SHIFT'}
            </span>
          </div>

          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>

          {/* Pending Offline Sales Sync Badge */}
          {pendingCount > 0 && (
            <button
              onClick={triggerSync}
              disabled={isSyncing || !isOnline}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-[11px] font-bold transition"
            >
              <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>
                {isSyncing ? 'Syncing...' : `Sync ${pendingCount} Sale${pendingCount > 1 ? 's' : ''}`}
              </span>
            </button>
          )}

          {/* Barcode Search Box */}
          <form onSubmit={handleBarcodeSubmit} className="relative w-64 md:w-80">
            <Scan className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode or type name (F2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-850 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
            />
          </form>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Pricing Tier Toggle */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setPricingTier('RETAIL')}
              className={`px-3 py-1 rounded-lg transition ${
                pricingTier === 'RETAIL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Retail
            </button>
            <button
              onClick={() => setPricingTier('WHOLESALE')}
              className={`px-3 py-1 rounded-lg transition ${
                pricingTier === 'WHOLESALE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Wholesale
            </button>
          </div>

          {/* Hold Carts List */}
          <button
            onClick={() => setShowHoldModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition"
            title="Held Carts (Shift + F4)"
          >
            <PauseCircle className="w-4 h-4 text-amber-400" />
            <span>Held Carts</span>
            {holdCarts.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                {holdCarts.length}
              </span>
            )}
          </button>

          {/* Lock Terminal Button */}
          <button
            onClick={() => setIsLocked(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition"
            title="Lock POS Terminal (Ctrl+L)"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Split Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Product Catalog Grid */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-800 bg-slate-950">
          {/* Category Horizontal Scroll */}
          <div className="p-3 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              All Items
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedCategory === c.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Product Items Grid */}
          <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((p) =>
              p.variants.map((v) => (
                <div
                  key={v._id}
                  onClick={() => addToCart(p, v)}
                  className={`group relative p-3 bg-slate-900 border rounded-2xl cursor-pointer transition flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] ${
                    v.currentStock <= 0
                      ? 'border-slate-800/40 opacity-40 grayscale cursor-not-allowed'
                      : 'border-slate-800/80 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10'
                  }`}
                >
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      {p.categoryName || 'General'}
                    </div>
                    <div className="font-bold text-sm text-white mt-1 group-hover:text-indigo-400 transition line-clamp-2">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {v.attributeName} <span className="text-[10px] text-slate-500">[{v.sku}]</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="font-black text-sm text-emerald-400">
                      ৳
                      {pricingTier === 'WHOLESALE'
                        ? (v.wholesaleSellingPrice || v.retailSellingPrice).toFixed(2)
                        : v.retailSellingPrice.toFixed(2)}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        v.currentStock <= 5
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {v.currentStock} {p.unit}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Active Cart & Total Panel */}
        <div className="w-96 lg:w-[420px] flex flex-col bg-slate-900 border-l border-slate-800 shrink-0">
          {/* Customer Selection Row */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <select
                id="customer-select"
                value={selectedCustomer?._id || ''}
                onChange={(e) => {
                  const cust = customers.find((c) => c._id === e.target.value);
                  setSelectedCustomer(cust || null);
                }}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none max-w-[200px]"
              >
                <option value="" className="bg-slate-900 text-white">
                  Walk-in Customer (F8)
                </option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id} className="bg-slate-900 text-white">
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
            {selectedCustomer && (
              <span className="text-[11px] text-amber-400 font-medium">
                Due: ৳{selectedCustomer.currentDueBalance.toFixed(2)}
              </span>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <ShoppingCart className="w-10 h-10 stroke-[1.5]" />
                <p className="text-xs">Cart is empty. Scan or tap items.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.variantId}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white">{item.productName}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.variantName} • ৳{item.unitSellingPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold text-white text-sm">
                      ৳{(item.quantity * item.unitSellingPrice).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {/* Quantity Stepper */}
                    <div className="flex items-center space-x-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                      <button
                        onClick={() => updateCartQty(item.variantId, -1)}
                        className="p-1 hover:text-white text-slate-400 rounded hover:bg-slate-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.variantId, 1)}
                        className="p-1 hover:text-white text-slate-400 rounded hover:bg-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeCartItem(item.variantId)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing & Checkout Summary Box */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="text-white font-medium">৳{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (VAT):</span>
                <span className="text-white font-medium">৳{totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Bill Discount:</span>
                <input
                  type="number"
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(Number(e.target.value))}
                  min={0}
                  className="w-20 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-right text-white font-semibold"
                />
              </div>
            </div>

            {/* Grand Total */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Payable Total</div>
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                  ৳{grandTotal.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleHoldCart}
                  disabled={cart.length === 0}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-amber-400 transition"
                  title="Park / Hold Cart (F4)"
                >
                  <PauseCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={openCheckout}
                  disabled={cart.length === 0}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/30"
                  title="Pay Now (F9)"
                >
                  <span>Pay Now</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Payment & Tender</h2>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {checkoutError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {checkoutError}
                </div>
              )}

              {/* Total Banner */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Amount Due</div>
                <div className="text-3xl font-black text-emerald-400 mt-1">
                  ৳{grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'CARD', label: 'Card (POS)', icon: CreditCard },
                  { id: 'MFS_BKASH', label: 'bKash', icon: Smartphone },
                  { id: 'MFS_NAGAD', label: 'Nagad', icon: Smartphone },
                  { id: 'CUSTOMER_DUE', label: 'Customer Due', icon: User },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition ${
                        paymentMethod === m.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Cash Tendered Calculator */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Cash Tendered (৳)
                    </label>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center space-x-2">
                    {[100, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashTendered((prev) => prev + amt)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                      >
                        +{amt}
                      </button>
                    ))}
                    <button
                      onClick={() => setCashTendered(grandTotal)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-indigo-400"
                    >
                      Exact (৳{grandTotal.toFixed(2)})
                    </button>
                  </div>

                  {/* Change Preview */}
                  <div className="p-3 bg-slate-800/40 rounded-xl flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400">Change to Return:</span>
                    <span
                      className={
                        cashTendered >= grandTotal ? 'text-emerald-400 text-sm' : 'text-rose-400'
                      }
                    >
                      ৳{Math.max(0, cashTendered - grandTotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel (Esc)
              </button>
              <button
                onClick={handleCheckoutSubmit}
                disabled={checkoutLoading || (paymentMethod === 'CASH' && cashTendered < grandTotal)}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-600/30"
              >
                {checkoutLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Complete Sale (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Carts Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Parked / Held Carts</h2>
              <button
                onClick={() => setShowHoldModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {holdCarts.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-8">No held carts available.</p>
              ) : (
                holdCarts.map((hc) => (
                  <div
                    key={hc._id}
                    className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white text-xs">{hc.cartLabel}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(hc.createdAt).toLocaleTimeString()} • {hc.items?.length || 0} items
                      </div>
                      <div className="text-xs font-bold text-emerald-400 mt-1">
                        ৳{hc.totalAmount?.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleResumeCart(hc._id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                    >
                      Resume
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl font-mono text-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <span className="font-bold text-slate-700">SALE RECEIPT</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs flex items-center space-x-1"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h1 className="text-base font-black tracking-tight">POINT OF SALE STORE</h1>
                <p className="text-[10px] text-slate-600 mt-0.5">Invoice: {completedSale.invoiceNo}</p>
                <div className="text-[10px] text-slate-500">
                  {new Date(completedSale.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {completedSale.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <div>
                      <div>{item.productName}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.quantity} x ৳{item.unitSellingPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold">৳{item.lineTotal.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>৳{completedSale.subtotal.toFixed(2)}</span>
                </div>
                {completedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-৳{completedSale.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>Grand Total:</span>
                  <span>৳{completedSale.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid ({completedSale.payments?.[0]?.method || 'CASH'}):</span>
                  <span>৳{completedSale.paidAmount.toFixed(2)}</span>
                </div>
                {completedSale.changeReturned > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Change:</span>
                    <span>৳{completedSale.changeReturned.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2">
                Thank you for shopping with us! Please come again.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen PIN Lock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 select-none">
          <div className="w-full max-w-xs text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Terminal Locked</h2>
              <p className="text-xs text-slate-400 mt-1">Enter PIN (default: 1234) to unlock register</p>
            </div>

            {/* PIN Dots */}
            <div className="flex justify-center space-x-3">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all ${
                    pinInput.length > idx
                      ? 'bg-indigo-500 border-indigo-500 scale-110'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                />
              ))}
            </div>

            {/* PIN Keypad */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => {
                    if (digit === 'C') {
                      setPinInput('');
                    } else if (digit === 'OK') {
                      if (pinInput === '1234' || pinInput.length >= 4) {
                        setIsLocked(false);
                        setPinInput('');
                      } else {
                        alert('Incorrect PIN');
                        setPinInput('');
                      }
                    } else {
                      if (pinInput.length < 4) {
                        const next = pinInput + digit;
                        setPinInput(next);
                        if (next === '1234' || next === '0000') {
                          setTimeout(() => {
                            setIsLocked(false);
                            setPinInput('');
                          }, 200);
                        }
                      }
                    }
                  }}
                  className="py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold text-lg hover:bg-slate-800 active:scale-95 transition shadow-sm"
                >
                  {digit}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
