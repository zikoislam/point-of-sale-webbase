'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { ShoppingBag, ShoppingCart, Loader2, CheckCircle2, PackageX, Search, Store } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface CatalogItem {
  productId: string;
  variantId: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  sku: string;
  attributeName: string;
  price: number;
  inStock: boolean;
}

const money = (v: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(v || 0);

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;

  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ orderNo: string; totalAmount: number } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });

  React.useEffect(() => {
    if (!slug) return;
    setCatalog(null);
    setError('');
    fetch(`/api/v1/storefront/stores/${slug}/products`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) setCatalog(json.data || []);
        else setError(json?.error?.message || 'Store not found');
      })
      .catch(() => setError('Could not reach the store. Please try again.'));
  }, [slug]);

  const cartItems = Object.entries(cart)
    .map(([variantId, qty]) => ({ item: catalog?.find((c) => c.variantId === variantId), qty }))
    .filter((x) => x.item && x.qty > 0);
  const cartTotal = cartItems.reduce((n, x) => n + (x.item!.price * x.qty), 0);
  const cartCount = cartItems.reduce((n, x) => n + x.qty, 0);

  const setQty = (variantId: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[variantId];
      else next[variantId] = qty;
      return next;
    });
  };

  const placeOrder = async () => {
    setPlacing(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/storefront/stores/${slug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.name, phone: form.phone, address: form.address },
          items: cartItems.map((x) => ({ variantId: x.item!.variantId, quantity: x.qty })),
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201 && json?.success) {
        setPlaced(json.data);
        setCart({});
        setCheckoutOpen(false);
      } else {
        setError(json?.error?.message || 'Could not place the order');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const filtered = (catalog || []).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
              <Store className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">Online Store</p>
              <p className="text-[10px] text-slate-400 leading-none mt-1">Cash on delivery</p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-52 pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setCheckoutOpen(cartCount > 0)}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            disabled={cartCount === 0}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">{money(cartTotal)}</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && !catalog && (
          <div className="text-center py-24 text-slate-400">{error}</div>
        )}

        {!catalog && !error && (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-slate-600" /></div>
        )}

        {/* Success */}
        {placed && (
          <div className="max-w-md mx-auto bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-1">Order placed!</h2>
            <p className="text-sm text-slate-400 mb-4">We will call you to confirm the delivery.</p>
            <div className="bg-slate-800 rounded-2xl p-4 mb-4">
              <p className="text-[11px] uppercase text-slate-500 tracking-wider">Order number</p>
              <p className="text-lg font-bold text-emerald-300">{placed.orderNo}</p>
              <p className="text-sm text-slate-400 mt-1">Total: {money(placed.totalAmount)} (cash on delivery)</p>
            </div>
            <button onClick={() => setPlaced(null)} className="text-sm text-blue-400 hover:text-blue-300">Continue shopping</button>
          </div>
        )}

        {/* Catalog */}
        {!placed && catalog && (
          filtered.length === 0 ? (
            <div className="text-center py-24 text-slate-500 flex flex-col items-center gap-3">
              <PackageX className="w-10 h-10 text-slate-700" />
              <p>{search ? 'No products match your search.' : 'No products listed yet — check back soon.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <div key={p.variantId} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden group hover:border-slate-700 transition-colors">
                  <div className="aspect-square bg-slate-800 relative">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700"><ShoppingBag className="w-10 h-10" /></div>
                    )}
                    {!p.inStock && (
                      <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs font-semibold text-rose-300">Out of stock</div>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{p.category}</p>
                    <p className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2">{p.name}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-base font-bold text-emerald-400">{money(p.price)}</span>
                      {p.inStock && (
                        <div className="flex items-center gap-1.5">
                          {cart[p.variantId] ? (
                            <>
                              <button onClick={() => setQty(p.variantId, cart[p.variantId] - 1)} className="w-7 h-7 bg-slate-800 rounded-lg text-lg leading-none hover:bg-slate-700">−</button>
                              <span className="w-6 text-center text-sm font-bold">{cart[p.variantId]}</span>
                              <button onClick={() => setQty(p.variantId, cart[p.variantId] + 1)} className="w-7 h-7 bg-blue-600 rounded-lg text-lg leading-none hover:bg-blue-500">+</button>
                            </>
                          ) : (
                            <button onClick={() => setQty(p.variantId, 1)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold">Add</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* Checkout modal */}
      {checkoutOpen && cartCount > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="w-full sm:max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Checkout</h2>

            <div className="space-y-2 mb-5">
              {cartItems.map(({ item, qty }) => (
                <div key={item!.variantId} className="flex items-center justify-between text-sm bg-slate-800/60 rounded-xl px-3.5 py-2.5">
                  <span className="text-slate-300">{item!.name} <span className="text-slate-500">× {qty}</span></span>
                  <span className="font-semibold">{money(item!.price * qty)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold px-3.5 pt-2">
                <span>Total (COD)</span>
                <span className="text-emerald-400">{money(cartTotal)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number *" className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Delivery address *" rows={2} className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Note (optional)" className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>

            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setCheckoutOpen(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold">Back</button>
              <button
                onClick={placeOrder}
                disabled={placing || !form.name || form.phone.length < 6 || form.address.length < 5}
                className={cn('flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2')}
              >
                {placing && <Loader2 className="w-4 h-4 animate-spin" />}
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
