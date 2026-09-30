'use client';

import Link from 'next/link';
import {
  ShoppingCart,
  Truck,
  Package,
  Landmark,
  UsersRound,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Receipt,
  Tags,
  Factory,
  Warehouse,
} from 'lucide-react';
import { ScrollingBanner } from '../components/ScrollingBanner';
import { useI18n } from '../lib/i18n';

/**
 * Opening (landing) page — BDBBC ERP Solution.
 *
 * Infographic layout: a round ERP badge on the left, colorful numbered
 * department pills on the right. Hovering selects a pill, clicking enters the
 * department. Colors come from a rotating palette, so new departments
 * automatically get the next unused color.
 */

/** Color palette — cycles, so department #13 would still get a fresh color. */
const PALETTE = [
  { gradient: 'from-amber-400 to-yellow-500', dot: 'bg-amber-400' },
  { gradient: 'from-orange-500 to-amber-600', dot: 'bg-orange-500' },
  { gradient: 'from-fuchsia-500 to-pink-600', dot: 'bg-fuchsia-500' },
  { gradient: 'from-violet-600 to-indigo-700', dot: 'bg-violet-500' },
  { gradient: 'from-pink-500 to-rose-600', dot: 'bg-pink-500' },
  { gradient: 'from-emerald-500 to-green-600', dot: 'bg-emerald-500' },
  { gradient: 'from-cyan-500 to-sky-600', dot: 'bg-cyan-500' },
  { gradient: 'from-sky-500 to-blue-600', dot: 'bg-sky-500' },
  { gradient: 'from-lime-500 to-green-600', dot: 'bg-lime-500' },
  { gradient: 'from-rose-500 to-red-600', dot: 'bg-rose-500' },
  { gradient: 'from-teal-500 to-cyan-600', dot: 'bg-teal-500' },
  { gradient: 'from-purple-500 to-fuchsia-600', dot: 'bg-purple-500' },
];
const colorFor = (index: number) => PALETTE[index % PALETTE.length];

/** Departments — each is its own pill; add more here and colors follow. */
interface DepartmentCard {
  no: string;
  nameKey: string;
  descKey: string;
  href: string;
  icon: React.ElementType;
  /** Modules that live inside this department (shown as chips on the card). */
  insideKeys?: string[];
}

const DEPARTMENTS: DepartmentCard[] = [
  // The five trading modules live together: one department, one entry point.
  {
    no: '01',
    nameKey: 'landing.tradeInventory',
    descKey: 'landing.tradeDesc',
    href: '/trade',
    icon: Warehouse,
    /** The modules that sit inside this department. */
    insideKeys: [
      'trade.pos',
      'trade.sales',
      'trade.purchase',
      'trade.inventory',
      'trade.wholesale',
    ],
  },
  { no: '02', nameKey: 'reports.accountsFinance', descKey: 'landing.accountsDesc', href: '/accounts', icon: Landmark },
  { no: '03', nameKey: 'reports.hrPayroll', descKey: 'landing.hrDesc', href: '/hr', icon: UsersRound },
  { no: '04', nameKey: 'reports.production', descKey: 'landing.productionDesc', href: '/production', icon: Factory },
  { no: '05', nameKey: 'reports.crmEcommerce', descKey: 'landing.crmDesc', href: '/crm', icon: ShoppingBag },
];

const FEATURES = [
  { label: 'Trade & Inventory Management' },
  { label: 'Sales Management' },
  { label: 'Purchase Management' },
  { label: 'Inventory Management' },
  { label: 'Smart POS' },
  { label: 'Wholesale & Retail' },
  { label: 'Production Management' },
  { label: 'Supply-chain Management' },
  { label: 'Export & Import Management (LC)', soon: true },
  { label: 'Accounts Management' },
  { label: 'Project Approval Management', soon: true },
  { label: 'Distribution Management' },
  { label: 'Dealer Management' },
  { label: 'SR Management' },
  { label: 'HR Management' },
  { label: 'CRM Management' },
  { label: 'eCommerce Management' },
  { label: 'Powerful Reporting' },
];

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col items-center p-6 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 left-2/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full text-center relative z-10 space-y-10 py-10">
        {/* Logo + Title */}
        <div className="space-y-5 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bdbbc-logo.svg"
            alt="BDBBC Software"
            className="h-28 md:h-36 w-auto drop-shadow-[0_10px_40px_rgba(56,189,248,0.25)]"
          />
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
            BDBBC ERP Solution
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
            One software to run many organizations — POS, sales, purchase, inventory,
            accounting, HR, production, CRM and your own online store.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            All-in-one multi-organization ERP
          </div>
        </div>

        {/* Scrolling brand marquee */}
        <ScrollingBanner message="WELCOME TO BDBBC SOFTWARE" />

        {/* ── Departments — infographic layout: round ERP + colored pills ── */}
        <div className="space-y-8 pt-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white">{t('landing.departments')}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Hover a pill to select it — click to enter the department
            </p>
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
            {/* Round ERP badge (the circle from the design) */}
            <div className="relative shrink-0 mx-auto lg:mx-0">
              <div className="w-52 h-52 md:w-64 md:h-64 rounded-full bg-slate-900 border-[12px] border-slate-700/70 shadow-2xl flex items-center justify-center ring-8 ring-slate-800/40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bdbbc-logo.svg" alt="BDBBC ERP" className="w-44 md:w-52" />
              </div>
              {/* Curved connector with department dots (desktop only) */}
              <svg
                className="hidden lg:block absolute -right-14 top-1/2 -translate-y-1/2 w-16 h-[620px]"
                viewBox="0 0 64 620"
                fill="none"
              >
                <path
                  d="M58 12 C 8 90, 8 530, 58 608"
                  stroke="#475569"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <circle
                    key={i}
                    cx={[54, 34, 18, 10, 10, 10, 18, 34, 54][i]}
                    cy={[40, 105, 170, 235, 300, 365, 430, 495, 560][i]}
                    r="8"
                    className={colorFor(i).dot}
                  />
                ))}
              </svg>
            </div>

            {/* Colored department pills */}
            <div className="flex-1 w-full space-y-3.5">
              {DEPARTMENTS.map((dept, idx) => {
                const c = colorFor(idx);
                const Icon = dept.icon;
                return (
                  <Link
                    key={dept.no}
                    href={dept.href}
                    className={`group flex items-center gap-4 pl-2.5 pr-5 py-2.5 rounded-full bg-gradient-to-r ${c.gradient} shadow-lg hover:scale-[1.02] hover:brightness-110 hover:ring-4 hover:ring-white/20 transition-all`}
                  >
                    <span className="w-12 h-12 rounded-full bg-white/95 text-slate-900 font-extrabold flex items-center justify-center shadow shrink-0">
                      {dept.no}
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block font-bold text-white text-lg leading-tight drop-shadow">
                        {t(dept.nameKey)}
                      </span>
                      <span className="block text-xs text-white/85 truncate">{t(dept.descKey)}</span>
                      {dept.insideKeys && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {dept.insideKeys.map((key) => (
                            <span
                              key={key}
                              className="px-1.5 py-0.5 rounded-md bg-white/15 text-[10px] font-semibold text-white/95"
                            >
                              {t(key)}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <Icon className="w-5 h-5 text-white/90 shrink-0" />
                    <ArrowRight className="w-5 h-5 text-white opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* New departments automatically pick the next palette color */}
          <p className="text-center text-[11px] text-slate-500">
            + More departments can be added anytime — each one gets its own color automatically.
          </p>
        </div>

        {/* Feature checklist */}
        <div className="space-y-5 text-left pt-6">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white">{t('landing.everythingIncluded')}</h2>
            <p className="text-sm text-slate-400 mt-1">All core modules ship in one place</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm"
              >
                {f.soon ? (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase">
                    Soon
                  </span>
                ) : (
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
                )}
                <span className={`text-sm ${f.soon ? 'text-slate-500' : 'text-slate-200'}`}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
