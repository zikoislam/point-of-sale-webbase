'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { money } from './ReportShell';

/**
 * Shared chart kit for the reports area.
 *
 * Every chart reuses the same dark theme, tooltip and money formatting so the
 * whole reports section looks consistent, and any report can add a graph with a
 * few lines. Charts sit ABOVE the existing tables — the table keeps the exact
 * numbers and the export buttons keep working.
 */

const AXIS = '#64748b';
const GRID = '#1e293b';

export const CHART_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
];

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
};

const colorAt = (i: number, override?: string) => override || CHART_COLORS[i % CHART_COLORS.length];

/** 1200000 → "1.2M", 12500 → "12k" — keeps axis labels short. */
export function compactNumber(value: any): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(Math.round(n));
}

const truncate = (value: any, max = 18): string => {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function EmptyChart() {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-slate-500">
      No data for this period.
    </div>
  );
}

export type ValueFormat = (value: any) => string;

export interface SeriesDef {
  key: string;
  name: string;
  color?: string;
}

/** Card wrapper with a title — matches the KPI/table cards. */
export function ChartCard({
  title,
  subtitle,
  right,
  height = 260,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </div>
  );
}

/** Line/area trend — for any date (or ordered) series. */
export function TrendChart({
  data,
  xKey,
  series,
  valueFormat = money,
}: {
  data: any[];
  xKey: string;
  series: SeriesDef[];
  valueFormat?: ValueFormat;
}) {
  const uid = React.useId().replace(/:/g, '');
  if (!data || data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorAt(i, s.color)} stopOpacity={0.45} />
              <stop offset="100%" stopColor={colorAt(i, s.color)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey={xKey} stroke={AXIS} fontSize={11} tickFormatter={(v) => truncate(v, 12)} />
        <YAxis stroke={AXIS} fontSize={11} tickFormatter={compactNumber} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => valueFormat(v)} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={colorAt(i, s.color)}
            fill={`url(#${uid}-${s.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranking bars — top products, debtors, vendors… */
export function RankBars({
  data,
  labelKey,
  valueKey,
  valueFormat = money,
  color,
  maxItems = 10,
  labelWidth = 150,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  valueFormat?: ValueFormat;
  color?: string;
  maxItems?: number;
  labelWidth?: number;
}) {
  const rows = (data || []).slice(0, maxItems);
  if (!rows.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" stroke={AXIS} fontSize={11} tickFormatter={compactNumber} />
        <YAxis
          type="category"
          dataKey={labelKey}
          stroke={AXIS}
          fontSize={11}
          width={labelWidth}
          tickFormatter={(v) => truncate(v, 20)}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => valueFormat(v)} />
        <Bar dataKey={valueKey} fill={color || CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut — share of a total (category, tier, payment method…). */
export function ShareDonut({
  data,
  nameKey,
  valueKey,
  valueFormat = money,
  colors = CHART_COLORS,
}: {
  data: any[];
  nameKey: string;
  valueKey: string;
  valueFormat?: ValueFormat;
  colors?: string[];
}) {
  const rows = (data || []).filter((d) => Number(d?.[valueKey]) > 0);
  if (!rows.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={rows}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => valueFormat(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Grouped vertical bars — compare a few measures side by side. */
export function CompareBars({
  data,
  xKey,
  series,
  valueFormat = money,
}: {
  data: any[];
  xKey: string;
  series: SeriesDef[];
  valueFormat?: ValueFormat;
}) {
  if (!data || data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey={xKey} stroke={AXIS} fontSize={11} tickFormatter={(v) => truncate(v, 12)} />
        <YAxis stroke={AXIS} fontSize={11} tickFormatter={compactNumber} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => valueFormat(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={colorAt(i, s.color)} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
