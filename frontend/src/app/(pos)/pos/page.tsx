'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scan,
  Search,
  ShoppingCart,
  Trash2,
  PauseCircle,
  PlayCircle,
  Lock,
  Unlock,
  LogOut,
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
import { useAuth } from '../../../hooks/useAuth';
import { queueOfflineSale } from '../../../lib/offline-queue';
import { EscposBuilder } from '../../../lib/escpos-builder';
import { openCashDrawer } from '../../../lib/cash-drawer';
import { BarcodeRenderer } from '../../../components/BarcodeRenderer';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  'Content-Type': 'application/json',
});
const fetchOpts = (opts: RequestInit = {}): RequestInit => ({
  ...opts,
  credentials: 'include' as RequestCredentials,
  headers: { ...authHeader(), ...(opts.headers as Record<string, string> || {}) },
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
  taxType: string;
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

/** One flat row of the barcode lookup panel (a single variant). */
interface SearchRow {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  barcode?: string;
  unit: string;
  stock: number;
  price: number;
}

export default function POSTerminalPage() {
  const { user, logout, lockTerminal, unlockTerminal } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pricingTier, setPricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  // Row highlighted in the cart grid / shown in the "Product Info." panel
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  // Slide-over product catalog (touch-friendly alternative to scanning)
  const [showCatalog, setShowCatalog] = useState(false);

  // Barcode lookup panel opened by the banner's "Product Search" button
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchModalTerm, setSearchModalTerm] = useState('');
  const [searchModalResults, setSearchModalResults] = useState<SearchRow[]>([]);
  const [searchModalLoading, setSearchModalLoading] = useState(false);

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
  const receiveInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Offline Sync Management
  const { isOnline, pendingCount, isSyncing, triggerSync, refreshPendingCount } = useOfflineSync(
    API,
    authHeader
  );

  // 1. Fetch Shift
  const fetchActiveShift = useCallback(async () => {
    try {
      const res = await fetch(`${API}/shifts/active`, fetchOpts());
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
        fetch(`${API}/categories`, fetchOpts()),
        fetch(`${API}/products?limit=100`, fetchOpts()),
      ]);
      const [cJson, pJson] = await Promise.all([cRes.json(), pRes.json()]);
      if (cJson.success) setCategories(cJson.data);

      if (pJson.success) {
        const fullProducts: Product[] = [];
        for (const p of pJson.data || []) {
          const det = await fetch(`${API}/products/${p.id}`, fetchOpts());
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
        fetch(`${API}/customers`, fetchOpts()),
        fetch(`${API}/sales/hold-carts`, fetchOpts()),
      ]);
      const [custJson, holdJson] = await Promise.all([custRes.json(), holdRes.json()]);
      if (custJson.success) setCustomers(custJson.data?.data || custJson.data || []);
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

    // Highlight this line in the grid and mirror it in the Product Info panel
    setCurrentVariantId(variant._id);

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
            taxType: product.taxType || 'INCLUSIVE',
            discount: 0,
            stockAvailable: variant.currentStock,
          },
        ];
      }
    });
  };

  // Manual product search (server-backed) for barcode / SKU / name
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    let active = true;
    setSearchingProducts(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/products?search=${encodeURIComponent(term)}&limit=8`, fetchOpts());
        const j = await res.json();
        if (active && j.success) {
          setSearchResults(j.data || []);
          setShowSearchResults(true);
        }
      } catch {
        // ignore — user can still use the grid
      } finally {
        if (active) setSearchingProducts(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Fetch a product's detail and add its first in-stock variant to the cart
  const addProductById = async (productId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/products/${productId}`, fetchOpts());
      const j = await res.json();
      if (!j.success || !j.data) return false;
      const product: Product = j.data;
      const variant =
        product.variants.find((v) => (v as any).isAvailable !== false && v.currentStock > 0) ||
        product.variants[0];
      if (!variant) return false;
      addToCart(product, variant);
      return true;
    } catch {
      return false;
    }
  };

  // "Product Search" — expands a term into every matching variant with its barcode
  const runProductSearch = useCallback(
    async (term: string) => {
      const q = term.trim();
      setSearchModalTerm(q);
      if (q.length < 2) {
        setSearchModalResults([]);
        return;
      }

      setSearchModalLoading(true);
      try {
        const res = await fetch(
          `${API}/products?search=${encodeURIComponent(q)}&limit=10`,
          fetchOpts()
        );
        const j = await res.json();
        const list: any[] = j.success ? j.data || [] : [];

        // The list endpoint returns summaries only, so pull details for the hits
        const details = await Promise.all(
          list.map(async (p) => {
            try {
              const dRes = await fetch(`${API}/products/${p.id}`, fetchOpts());
              const dJson = await dRes.json();
              return dJson.success ? dJson.data : null;
            } catch {
              return null;
            }
          })
        );

        const rows: SearchRow[] = [];
        for (const p of details) {
          if (!p) continue;
          for (const v of p.variants || []) {
            rows.push({
              productId: p.id,
              productName: p.name,
              variantId: v._id,
              variantName: v.attributeName,
              sku: v.sku,
              barcode: v.barcode,
              unit: p.unit,
              stock: v.currentStock,
              price:
                pricingTier === 'WHOLESALE'
                  ? v.wholesaleSellingPrice || v.retailSellingPrice
                  : v.retailSellingPrice,
            });
          }
        }
        setSearchModalResults(rows);
      } catch {
        setSearchModalResults([]);
      } finally {
        setSearchModalLoading(false);
      }
    },
    [pricingTier]
  );

  // Live-search inside the panel
  useEffect(() => {
    if (!showSearchModal) return;
    const t = setTimeout(() => {
      runProductSearch(searchModalTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchModalTerm, showSearchModal, runProductSearch]);

  // Add a search-panel row straight to the cart
  const addSearchRowToCart = async (row: SearchRow) => {
    const product = products.find((p) => p.id === row.productId);
    let variant = product?.variants.find((v) => v._id === row.variantId);

    if (!variant) {
      const ok = await addProductById(row.productId);
      if (ok) setShowSearchModal(false);
      return;
    }

    const fullProduct = product as Product;
    addToCart(fullProduct, variant);
    setShowSearchModal(false);
  };

  // Barcode enter lookup
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;
    const lower = term.toLowerCase();

    // 1. Exact match in the already-loaded catalog
    for (const p of products) {
      for (const v of p.variants) {
        if (
          v.barcode?.toLowerCase() === lower ||
          v.sku?.toLowerCase() === lower ||
          p.name.toLowerCase() === lower
        ) {
          addToCart(p, v);
          setSearchQuery('');
          setShowSearchResults(false);
          return;
        }
      }
    }

    // 2. Server-side barcode / SKU lookup (covers items not in the loaded page)
    try {
      const res = await fetch(`${API}/products/barcode/${encodeURIComponent(term)}`, fetchOpts());
      const j = await res.json();
      if (j.success && j.data) {
        const product: Product = j.data;
        const variant =
          product.variants.find((v) => (v as any).isAvailable !== false && v.currentStock > 0) ||
          product.variants[0];
        if (variant) {
          addToCart(product, variant);
          setSearchQuery('');
          setShowSearchResults(false);
          return;
        }
      }
    } catch {
      // fall through to search results
    }

    // 3. If the manual search narrowed to a single product, add it
    if (searchResults.length === 1) {
      const ok = await addProductById(searchResults[0].id);
      if (ok) {
        setSearchQuery('');
        setShowSearchResults(false);
        return;
      }
    }

    alert(`No exact product found for "${term}". Pick one from the search results list.`);
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

  // "Cancel" — discard the whole ticket
  const handleCancelTicket = () => {
    if (cart.length === 0) return;
    if (!confirm('Cancel this sale and clear the cart?')) return;
    setCart([]);
    setSelectedCustomer(null);
    setOverallDiscount(0);
    setCurrentVariantId(null);
  };

  // "Remove" — drop only the highlighted grid row
  const handleRemoveCurrent = () => {
    const row = cart.find((i) => i.variantId === currentVariantId);
    if (!row) return;
    removeCartItem(row.variantId);
    setCurrentVariantId(null);
  };

  // "Close" — leave the POS terminal
  const handleCloseTerminal = () => {
    router.push('/dashboard');
  };

  // "Exit" — sign out completely and come back to a fresh login page
  const handleExit = async () => {
    if (cart.length > 0 && !confirm('There are items in the current cart. Sign out anyway?')) {
      return;
    }
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  };

  // Cart Calculations — mirrors server Rule 1 (INCLUSIVE tax is inside the price)
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const lineGross = (item: CartItem) => item.quantity * item.unitSellingPrice;
  const lineNet = (item: CartItem) => Math.max(0, lineGross(item) - (item.discount || 0));
  const lineTax = (item: CartItem) => {
    if (item.taxType === 'EXCLUSIVE') return (lineNet(item) * item.taxRate) / 100;
    if (item.taxType === 'INCLUSIVE') return lineNet(item) - lineNet(item) / (1 + item.taxRate / 100);
    return 0;
  };
  const lineTotal = (item: CartItem) =>
    item.taxType === 'EXCLUSIVE' ? lineNet(item) + lineTax(item) : lineNet(item);

  const subtotal = round2(cart.reduce((acc, item) => acc + lineNet(item), 0));
  const totalTax = round2(cart.reduce((acc, item) => acc + lineTax(item), 0));
  const grandTotal = Math.max(
    0,
    round2(cart.reduce((acc, item) => acc + lineTotal(item), 0) - overallDiscount)
  );

  // Hold Cart
  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    const label = prompt('Enter a label for this held cart (e.g. Customer Name):') || 'Parked Cart';
    try {
      const res = await fetch(`${API}/sales/hold-cart`, fetchOpts({
        method: 'POST',
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
      }));
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
      const res = await fetch(`${API}/sales/hold-cart/${cartId}/resume`, fetchOpts({
        method: 'POST',
      }));
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
            taxType: i.taxType || 'INCLUSIVE',
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
          amount: paymentMethod === 'CASH' ? cashTendered : grandTotal,
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
      const res = await fetch(`${API}/sales/checkout`, fetchOpts({
        method: 'POST',
        headers: { 'Idempotency-Key': payload.idempotencyKey },
        body: JSON.stringify(payload),
      }));

      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message || j.message || 'Checkout failed');

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

  // Lock terminal on both client and server so the API is actually protected
  const handleLockTerminal = () => {
    setIsLocked(true);
    lockTerminal().catch(() => {});
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
    onLockTerminal: handleLockTerminal,
    onCloseModals: () => {
      setShowCheckoutModal(false);
      setShowReceiptModal(false);
      setShowHoldModal(false);
      setShowSearchModal(false);
      setShowCatalog(false);
    },
    onConfirmPayment: handleCheckoutSubmit,
    isPaymentModalOpen: showCheckoutModal,
  });

  // Extra terminal keys that don't collide with usePOSHotkeys (F2/F4/F8/F9 stay as-is)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        handleCloseTerminal();
      }
      if (e.key === 'F11') {
        e.preventDefault();
        receiveInputRef.current?.focus();
        receiveInputRef.current?.select();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        openCheckout();
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        handleRemoveCurrent();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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

  // Classic desktop field styling shared by the read-only info panels
  const fieldCls =
    'w-full px-1.5 py-0.5 bg-white border border-slate-400 rounded-sm text-[11px] text-slate-900 focus:outline-none focus:border-[#0f9aa8]';
  const idFieldCls =
    'w-full px-1.5 py-0.5 bg-white border border-slate-400 rounded-sm text-[11px] font-bold text-red-600 focus:outline-none focus:border-[#0f9aa8]';
  const labelCls = 'text-[11px] text-slate-700 whitespace-nowrap';
  const legendCls = 'text-[11px] font-semibold text-slate-700 px-1';

  // The line shown in the "Product Info." panel (last scanned, or grid selection)
  const currentItem =
    cart.find((i) => i.variantId === currentVariantId) || cart[cart.length - 1] || null;
  const currentProduct = currentItem
    ? products.find((p) =>
        p.variants.some((v) => v._id === currentItem.variantId)
      ) || null
    : null;

  const now = new Date();
  const shiftRef = activeShift ? `SHIFT-${activeShift._id.slice(-6).toUpperCase()}` : '—';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#dfe3e6] text-slate-900 overflow-hidden select-none">
      {/* Teal terminal banner */}
      <header className="bg-[#0f9aa8] border-b-2 border-[#0b7d88] px-4 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-sm">
        <h1 className="text-white text-lg font-bold tracking-tight whitespace-nowrap">
          Point Of Sale (POS) System
        </h1>

        <form onSubmit={handleBarcodeSubmit} className="relative flex items-center gap-2 ml-auto">
          <label className="text-white text-sm whitespace-nowrap">Barcode Reader:</label>
          <input
            ref={barcodeInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
            placeholder="Scan or type (F2)"
            className="w-56 md:w-72 px-2 py-1 bg-white border border-[#0b7d88] rounded-sm text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
          />
          <button
            type="button"
            onClick={() => {
              setSearchModalTerm(searchQuery);
              setShowSearchModal(true);
            }}
            className="px-4 py-1 bg-[#0b7d88] hover:bg-[#0a6d77] text-white text-sm font-semibold rounded-sm transition"
            title="Search products and see their barcodes"
          >
            Product Search
          </button>

          {/* Manual search results dropdown */}
          {showSearchResults && (
            <div className="absolute right-0 top-full mt-1 z-40 w-80 bg-white border border-slate-400 rounded-sm shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
              {searchingProducts ? (
                <div className="px-3 py-3 text-xs text-slate-500">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500">
                  No products match &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      const ok = await addProductById(p.id);
                      if (ok) {
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#d7eef1] border-b border-slate-200 last:border-0 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{p.categoryName || ''}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">
                        Stock: {p.totalStock ?? 0} {p.unit || ''}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        ৳{Number(p.lowestRetailPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </form>
      </header>

      {/* Status strip */}
      <div className="bg-[#eef1f2] border-b border-slate-300 px-3 py-1.5 flex items-center gap-2 flex-wrap shrink-0 text-[11px]">
        <span className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-300 rounded-sm font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {activeShift ? activeShift.terminalId : 'NO SHIFT'}
        </span>

        <span
          className={`flex items-center gap-1.5 px-2 py-1 rounded-sm font-bold border ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
          }`}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? 'Online' : 'Offline Mode'}
        </span>

        {pendingCount > 0 && (
          <button
            onClick={triggerSync}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 font-bold transition"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
            {isSyncing ? 'Syncing...' : `Sync ${pendingCount} Sale${pendingCount > 1 ? 's' : ''}`}
          </button>
        )}

        <span className="ml-auto" />

        {/* Pricing Tier Toggle */}
        <div className="flex items-center bg-white border border-slate-300 rounded-sm font-semibold overflow-hidden">
          <button
            onClick={() => setPricingTier('RETAIL')}
            className={`px-3 py-1 transition ${
              pricingTier === 'RETAIL' ? 'bg-[#0f9aa8] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Retail
          </button>
          <button
            onClick={() => setPricingTier('WHOLESALE')}
            className={`px-3 py-1 transition ${
              pricingTier === 'WHOLESALE' ? 'bg-[#0f9aa8] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Wholesale
          </button>
        </div>

        <button
          onClick={() => setShowCatalog(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-white hover:bg-slate-100 border border-slate-300 font-semibold text-slate-700 transition"
          title="Browse the product catalog"
        >
          <Layers className="w-3.5 h-3.5 text-slate-600" />
          Catalog
        </button>

        <button
          onClick={() => setShowHoldModal(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-white hover:bg-slate-100 border border-slate-300 font-semibold text-slate-700 transition"
          title="Held Carts (Shift + F4)"
        >
          <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
          Held Carts
          {holdCarts.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center">
              {holdCarts.length}
            </span>
          )}
        </button>

        <button
          onClick={handleLockTerminal}
          className="p-1.5 rounded-sm bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 transition"
          title="Lock POS Terminal (Ctrl+L)"
        >
          <Lock className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-[#e2574c] hover:bg-[#cf4a40] border border-[#c33f36] text-white font-bold transition"
          title="Sign out and return to the login page"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>

      {/* Main terminal body */}
      <div className="flex-1 flex gap-2 p-2 overflow-hidden">
        {/* LEFT COLUMN: info panels on top, line items below */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden min-w-0">
          {/* Transaction. + Customer Info. */}
          <div className="flex gap-2 items-stretch shrink-0">
            <fieldset className="flex-1 min-w-0 bg-[#f7f8f9] border border-slate-400 rounded-sm px-3 pb-2.5 pt-1">
              <legend className={legendCls}>Transaction.</legend>
              <div className="grid grid-cols-[86px_1fr_86px_1fr] gap-x-3 gap-y-1.5 items-center">
                <span className={labelCls}>Current Date :</span>
                <input
                  readOnly
                  value={now.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  className={fieldCls}
                />

                <span className={labelCls}>Employee ID :</span>
                <input readOnly value={user?.username || '—'} className={fieldCls} />

                <span className={labelCls}>Transaction ID :</span>
                <input
                  readOnly
                  value={`INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-#####`}
                  className={idFieldCls}
                />

                <span className={labelCls}>Employee :</span>
                <input readOnly value={user?.fullName || '—'} className={fieldCls} />

                <span className={labelCls}>Reference No. :</span>
                <input readOnly value={shiftRef} className={idFieldCls} />

                <span className={labelCls}>Position :</span>
                <input
                  readOnly
                  value={(user?.role || '—').replace('_', ' ')}
                  className={fieldCls}
                />

                <span className={labelCls}>Payment Method :</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className={`${fieldCls} font-semibold`}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="MFS_BKASH">bKash</option>
                  <option value="MFS_NAGAD">Nagad</option>
                  <option value="CUSTOMER_DUE">Customer Due</option>
                </select>

                <span className={labelCls}>Time :</span>
                <input readOnly value={now.toLocaleTimeString()} className={fieldCls} />
              </div>
            </fieldset>

            <fieldset className="w-[270px] shrink-0 bg-[#f7f8f9] border border-slate-400 rounded-sm px-3 pb-2.5 pt-1">
              <legend className={legendCls}>Customer Info.</legend>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className={labelCls}>Type :</span>
                  <label className="flex items-center gap-1 text-[11px] text-slate-700">
                    <input
                      type="radio"
                      name="customerType"
                      checked={!selectedCustomer}
                      onChange={() => setSelectedCustomer(null)}
                    />
                    General
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-700">
                    <input
                      type="radio"
                      name="customerType"
                      checked={!!selectedCustomer}
                      onChange={() => {}}
                    />
                    Member
                  </label>
                </div>

                <div className="grid grid-cols-[70px_1fr] gap-x-2 items-center">
                  <span className={labelCls}>Member ID :</span>
                  <select
                    id="customer-select"
                    value={selectedCustomer?._id || ''}
                    onChange={(e) => {
                      const cust = customers.find((c) => c._id === e.target.value);
                      setSelectedCustomer(cust || null);
                    }}
                    className={fieldCls}
                  >
                    <option value="">Walk-in (F8)</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>

                  <span className={labelCls}>Full Name :</span>
                  <input readOnly value={selectedCustomer?.name || '—'} className={fieldCls} />
                </div>

                {selectedCustomer && (
                  <div className="text-[11px] font-semibold text-red-600">
                    Outstanding due: ৳{selectedCustomer.currentDueBalance.toFixed(2)} / limit ৳
                    {selectedCustomer.creditLimit.toFixed(2)}
                  </div>
                )}
              </div>
            </fieldset>
          </div>

          {/* Product Info. */}
          <fieldset className="shrink-0 bg-[#f7f8f9] border border-slate-400 rounded-sm px-3 pb-2.5 pt-1">
            <legend className={legendCls}>Product Info.</legend>
            <div className="grid grid-cols-[86px_1fr_86px_1fr_86px_auto] gap-x-3 gap-y-1.5 items-center">
              <span className={labelCls}>Product ID :</span>
              <input readOnly value={currentItem?.barcode || currentItem?.sku || ''} className={idFieldCls} />

              <span className={labelCls}>Descriptions :</span>
              <input readOnly value={currentItem?.variantName || ''} className={fieldCls} />

              <span className={labelCls}>Stocked :</span>
              <input readOnly value={currentItem ? currentItem.stockAvailable : ''} className={fieldCls} />

              <span className={labelCls}>Product Name :</span>
              <input readOnly value={currentItem?.productName || ''} className={fieldCls} />

              <span className={labelCls}>Unit Price :</span>
              <input
                readOnly
                value={currentItem ? `৳${currentItem.unitSellingPrice.toFixed(2)}` : ''}
                className={idFieldCls}
              />

              <span className={labelCls}>Quantity :</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => currentItem && updateCartQty(currentItem.variantId, -1)}
                  disabled={!currentItem}
                  className="w-7 h-7 flex items-center justify-center bg-white border border-slate-400 rounded-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  title="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input readOnly value={currentItem?.quantity ?? ''} className={`${fieldCls} w-14 text-center font-bold`} />
                <button
                  type="button"
                  onClick={() => currentItem && updateCartQty(currentItem.variantId, 1)}
                  disabled={!currentItem}
                  className="w-7 h-7 flex items-center justify-center bg-white border border-slate-400 rounded-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  title="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </fieldset>

          {/* Line items grid */}
          <div className="flex-1 bg-white border border-slate-400 rounded-sm overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1f5fa8] text-white">
                    <th className="w-6 border border-[#17497f] py-1" />
                    <th className="border border-[#17497f] py-1 px-2 text-left font-semibold">
                      Product Barcode
                    </th>
                    <th className="border border-[#17497f] py-1 px-2 text-left font-semibold">
                      Product Name
                    </th>
                    <th className="border border-[#17497f] py-1 px-2 text-left font-semibold">
                      Descriptions
                    </th>
                    <th className="border border-[#17497f] py-1 px-2 text-right font-semibold">
                      Unit Price
                    </th>
                    <th className="border border-[#17497f] py-1 px-2 text-center font-semibold">
                      Quantity
                    </th>
                    <th className="border border-[#17497f] py-1 px-2 text-right font-semibold">
                      Sub Total
                    </th>
                    <th className="border border-[#17497f] py-1 px-2 text-center font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        Scan a barcode or open the Catalog to add items to this sale.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => {
                      const isCurrent = item.variantId === currentVariantId;
                      return (
                        <tr
                          key={item.variantId}
                          onClick={() => setCurrentVariantId(item.variantId)}
                          className={`cursor-pointer ${
                            isCurrent ? 'bg-[#cfe4fb]' : 'odd:bg-white even:bg-[#f6f7f8] hover:bg-[#e9f2fd]'
                          }`}
                        >
                          <td className="border border-slate-300 py-1 text-center text-slate-500">
                            <ChevronRight className="w-3 h-3 inline" />
                          </td>
                          <td className="border border-slate-300 py-1 px-2 font-mono text-slate-700">
                            {item.barcode || item.sku}
                          </td>
                          <td className="border border-slate-300 py-1 px-2 font-semibold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="border border-slate-300 py-1 px-2 text-slate-600">
                            {item.variantName}
                          </td>
                          <td className="border border-slate-300 py-1 px-2 text-right text-slate-800">
                            ৳{item.unitSellingPrice.toFixed(2)}
                          </td>
                          <td className="border border-slate-300 py-1 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartQty(item.variantId, -1);
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-white border border-slate-400 rounded-sm hover:bg-slate-100"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-9 text-center font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartQty(item.variantId, 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-white border border-slate-400 rounded-sm hover:bg-slate-100"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>
                          <td className="border border-slate-300 py-1 px-2 text-right font-bold text-slate-900">
                            ৳{lineTotal(item).toFixed(2)}
                          </td>
                          <td className="border border-slate-300 py-1 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCartItem(item.variantId);
                                if (isCurrent) setCurrentVariantId(null);
                              }}
                              className="text-slate-500 hover:text-rose-600"
                              title="Remove this line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: action buttons + running totals */}
        <div className="w-[268px] shrink-0 flex flex-col gap-2">
          <div className="space-y-2">
            <button
              onClick={handleCancelTicket}
              disabled={cart.length === 0}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f0a04b] hover:bg-[#e08f3a] disabled:opacity-50 text-white text-sm font-bold rounded-sm border border-[#d9822b] shadow-sm transition"
            >
              <span>Cancel</span>
              <span className="text-[11px] font-normal opacity-90">(Esc)</span>
            </button>

            <button
              onClick={handleCloseTerminal}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#e2574c] hover:bg-[#cf4a40] text-white text-sm font-bold rounded-sm border border-[#c33f36] shadow-sm transition"
            >
              <span>Close</span>
              <span className="text-[11px] font-normal opacity-90">(F3)</span>
            </button>

            <button
              onClick={handleRemoveCurrent}
              disabled={!currentItem}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f2a8a8] hover:bg-[#e89595] disabled:opacity-50 text-[#7a1f1f] text-sm font-bold rounded-sm border border-[#dc8c8c] shadow-sm transition"
            >
              <span>Remove</span>
              <span className="text-[11px] font-normal opacity-90">(Del)</span>
            </button>

            <button
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-sm border border-slate-400 transition"
            >
              <span>Hold / Park</span>
              <span className="text-[11px] font-normal opacity-70">(F4)</span>
            </button>
          </div>

          <fieldset className="bg-[#f7f8f9] border border-slate-400 rounded-sm px-3 pb-3 pt-1">
            <legend className={legendCls}>Summary</legend>
            <div className="space-y-2">
              <div className="grid grid-cols-[62px_1fr] gap-2 items-center">
                <span className={labelCls}>Subtotal :</span>
                <input readOnly value={subtotal.toFixed(2)} className={`${fieldCls} text-right font-semibold`} />

                <span className={labelCls}>Discount :</span>
                <input
                  type="number"
                  min={0}
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(Number(e.target.value))}
                  className={`${fieldCls} text-right`}
                />

                <span className={labelCls}>Tax (VAT) :</span>
                <input readOnly value={totalTax.toFixed(2)} className={`${fieldCls} text-right`} />

                <span className={labelCls}>Total :</span>
                <input
                  readOnly
                  value={grandTotal.toFixed(2)}
                  className={`${fieldCls} text-right font-bold text-red-600`}
                />

                <span className={labelCls}>Receive :</span>
                <input
                  ref={receiveInputRef}
                  type="number"
                  min={0}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                  className={`${fieldCls} text-right`}
                />

                <span className={labelCls}>Change :</span>
                <input
                  readOnly
                  value={Math.max(0, cashTendered - grandTotal).toFixed(2)}
                  className={`${fieldCls} text-right font-bold`}
                />
              </div>

              <div className="flex gap-1 pt-1">
                {[100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashTendered(Number(cashTendered) + amt)}
                    className="flex-1 px-2 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded-sm text-[10px] font-bold text-slate-700"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCashTendered(grandTotal)}
                className="w-full px-2 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded-sm text-[10px] font-bold text-slate-700"
              >
                Exact amount
              </button>

              <button
                onClick={openCheckout}
                disabled={cart.length === 0}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#f0a04b] hover:bg-[#e08f3a] disabled:opacity-50 text-white text-sm font-bold rounded-sm border border-[#d9822b] shadow-sm transition"
              >
                <span className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Complete &amp; Print
                </span>
                <span className="text-[11px] font-normal opacity-90">(F12)</span>
              </button>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Product search / barcode lookup panel */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-4xl bg-[#f7f8f9] border border-slate-400 rounded-sm shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f9aa8] border-b-2 border-[#0b7d88]">
              <h2 className="text-white font-bold text-sm">Product Search — Barcode Lookup</h2>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-white/90 hover:text-white"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-300 bg-white flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                autoFocus
                value={searchModalTerm}
                onChange={(e) => setSearchModalTerm(e.target.value)}
                placeholder="Type product name, SKU or barcode…"
                className="flex-1 px-2 py-1.5 bg-white border border-slate-400 rounded-sm text-sm text-slate-900 focus:outline-none focus:border-[#0f9aa8]"
              />
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {searchModalLoading ? 'Searching…' : `${searchModalResults.length} variant(s)`}
              </span>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-3">
              {searchModalResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  {searchModalTerm.trim().length < 2
                    ? 'Type at least 2 characters to search.'
                    : searchModalLoading
                      ? 'Searching…'
                      : 'No matching products.'}
                </div>
              ) : (
                <table className="w-full border-collapse text-[11px] bg-white">
                  <thead>
                    <tr className="bg-[#1f5fa8] text-white">
                      <th className="border border-[#17497f] py-1 px-2 text-left">Product</th>
                      <th className="border border-[#17497f] py-1 px-2 text-left">Variant / SKU</th>
                      <th className="border border-[#17497f] py-1 px-2 text-left">Barcode No.</th>
                      <th className="border border-[#17497f] py-1 px-2 text-center">Barcode</th>
                      <th className="border border-[#17497f] py-1 px-2 text-right">Price</th>
                      <th className="border border-[#17497f] py-1 px-2 text-center">Stock</th>
                      <th className="border border-[#17497f] py-1 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchModalResults.map((row) => {
                      const code = row.barcode || row.sku;
                      return (
                        <tr key={row.variantId} className="odd:bg-white even:bg-[#f6f7f8]">
                          <td className="border border-slate-300 py-1.5 px-2 font-semibold text-slate-900">
                            {row.productName}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-600">
                            {row.variantName} <span className="text-slate-400">[{row.sku}]</span>
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-mono font-bold text-red-600">
                            {row.barcode || <span className="text-slate-400 font-normal">no barcode</span>}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2">
                            <div className="flex items-center justify-center bg-white">
                              <BarcodeRenderer value={code} height={28} width={1.2} />
                            </div>
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-right text-slate-800">
                            ৳{row.price.toFixed(2)}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded-sm font-bold ${
                                row.stock <= 5
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {row.stock} {row.unit}
                            </span>
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            <button
                              onClick={() => addSearchRowToCart(row)}
                              disabled={row.stock <= 0}
                              className="px-2 py-1 bg-[#0f9aa8] hover:bg-[#0b7d88] disabled:opacity-40 text-white text-[10px] font-bold rounded-sm whitespace-nowrap"
                            >
                              Add to Cart
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-3 py-2 border-t border-slate-300 bg-white flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                The barcode image is scannable and printable.
              </span>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0a04b] hover:bg-[#e08f3a] text-white text-xs font-bold rounded-sm border border-[#d9822b]"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product catalog slide-over */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 flex justify-start">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCatalog(false)} />
          <div className="relative w-[760px] max-w-full h-full bg-[#f7f8f9] border-r border-slate-400 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f9aa8] border-b-2 border-[#0b7d88] shrink-0">
              <h2 className="text-white font-bold text-sm">Product Catalog</h2>
              <button
                onClick={() => setShowCatalog(false)}
                className="text-white/90 hover:text-white"
                title="Close catalog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-slate-300 flex items-center gap-2 overflow-x-auto shrink-0 bg-white">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-sm text-[11px] font-bold shrink-0 border transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#0f9aa8] text-white border-[#0b7d88]'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                All Items
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1 rounded-sm text-[11px] font-bold shrink-0 border transition ${
                    selectedCategory === c.id
                      ? 'bg-[#0f9aa8] text-white border-[#0b7d88]'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start">
              {filteredProducts.map((p) =>
                p.variants.map((v) => (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => addToCart(p, v)}
                    disabled={v.currentStock <= 0}
                    className={`text-left p-2 bg-white border rounded-sm transition flex flex-col justify-between min-h-[74px] ${
                      v.currentStock <= 0
                        ? 'border-slate-300 opacity-50 cursor-not-allowed'
                        : 'border-slate-300 hover:border-[#0f9aa8] hover:bg-[#eaf7f9]'
                    }`}
                  >
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold">
                        {p.categoryName || 'General'}
                      </div>
                      <div className="font-bold text-[11px] text-slate-900 leading-tight mt-0.5">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {v.attributeName} <span className="text-slate-400">[{v.sku}]</span>
                      </div>
                    </div>

                    <div className="mt-1.5 pt-1 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-black text-[11px] text-emerald-700">
                        ৳
                        {pricingTier === 'WHOLESALE'
                          ? (v.wholesaleSellingPrice || v.retailSellingPrice).toFixed(2)
                          : v.retailSellingPrice.toFixed(2)}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded-sm ${
                          v.currentStock <= 5
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {v.currentStock} {p.unit}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
              <p className="text-xs text-slate-400 mt-1">Enter your 4-digit PIN to unlock register</p>
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
                      if (pinInput.length === 4) {
                        (async () => {
                          try {
                            await unlockTerminal(pinInput);
                            setIsLocked(false);
                            setPinInput('');
                          } catch (err: any) {
                            alert(err.message || 'Incorrect PIN');
                            setPinInput('');
                          }
                        })();
                      } else {
                        alert('Enter your 4-digit PIN');
                      }
                    } else {
                      if (pinInput.length < 4) {
                        setPinInput(pinInput + digit);
                      }
                    }
                  }}
                  className="py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white font-bold text-lg hover:bg-slate-800 active:scale-95 transition shadow-sm"
                >
                  {digit}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsLocked(false);
                setPinInput('');
                try {
                  await logout();
                } finally {
                  router.replace('/login');
                }
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors pt-1"
            >
              Switch Account / Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
