'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { OpenShiftModal } from '@/components/modals/OpenShiftModal';
import { CloseShiftModal } from '@/components/modals/CloseShiftModal';
import { PettyCashModal } from '@/components/modals/PettyCashModal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Monitor,
  Clock,
  Lock,
  Unlock,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
} from 'lucide-react';

interface Shift {
  _id: string;
  userId: { _id: string; name: string; email: string } | string;
  terminalId: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashSalesTotal: number;
  cashExpensesTotal: number;
  pettyCashIn: number;
  pettyCashOut: number;
  expectedCash: number;
  actualCash?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  createdAt: string;
}

function formatDuration(start: string, end?: string) {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((to - from) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function ShiftsPage() {
  const router = useRouter();
  const toast = useToast();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPettyModal, setShowPettyModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsRes, activeRes] = await Promise.all([
        api.get('/shifts', { params: { page, limit: 15 } }),
        api.get('/shifts/current').catch(() => ({ data: null })),
      ]);

      const data = shiftsRes.data;
      if (data && Array.isArray(data.data)) {
        setShifts(data.data);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        setShifts(data);
      }

      setActiveShift(activeRes?.data || null);
    } catch (err: any) {
      toast.error('Error', 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDiscrepancyDisplay = (discrepancy?: number) => {
    if (discrepancy === undefined || discrepancy === null) return { icon: null, text: '—', color: 'text-slate-400' };
    if (discrepancy === 0) return { icon: <Minus className="w-3 h-3" />, text: formatCurrency(0), color: 'text-emerald-400' };
    if (discrepancy > 0) return { icon: <TrendingUp className="w-3 h-3" />, text: `+${formatCurrency(discrepancy)}`, color: 'text-amber-400' };
    return { icon: <TrendingDown className="w-3 h-3" />, text: formatCurrency(discrepancy), color: 'text-rose-400' };
  };

  const activeShiftForClose = activeShift ? {
    _id: activeShift._id,
    terminalId: activeShift.terminalId,
    openingFloat: activeShift.openingFloat,
    cashSalesTotal: activeShift.cashSalesTotal,
    cashExpensesTotal: activeShift.cashExpensesTotal,
    pettyCashIn: activeShift.pettyCashIn,
    pettyCashOut: activeShift.pettyCashOut,
    expectedCash: activeShift.expectedCash,
  } : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Monitor className="w-7 h-7 text-blue-500" />
            Shift Management
          </h1>
          <p className="text-sm text-slate-400">
            Manage cash register shifts, petty cash, and print Z-Reports for each shift
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeShift ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setShowPettyModal(true)}
                leftIcon={<Wallet className="w-4 h-4" />}
              >
                Petty Cash
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowCloseModal(true)}
                leftIcon={<Lock className="w-4 h-4" />}
              >
                Close Shift
              </Button>
            </>
          ) : (
            <Button
              variant="success"
              onClick={() => setShowOpenModal(true)}
              leftIcon={<Unlock className="w-4 h-4" />}
            >
              Open Shift
            </Button>
          )}
        </div>
      </div>

      {/* Active Shift Summary */}
      {activeShift && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400">Active Shift — {activeShift.terminalId}</span>
              </div>
              <Badge variant="success">OPEN</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Duration</p>
                <p className="font-semibold text-slate-200">
                  {formatDuration(activeShift.openedAt)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Opening Float</p>
                <p className="font-semibold text-slate-200">{formatCurrency(activeShift.openingFloat)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Cash Sales</p>
                <p className="font-semibold text-emerald-400">{formatCurrency(activeShift.cashSalesTotal)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Expected Cash Now</p>
                <p className="font-bold text-blue-400">{formatCurrency(activeShift.expectedCash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shift History Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Terminal</th>
                  <th className="p-3.5">Cashier</th>
                  <th className="p-3.5">Opened</th>
                  <th className="p-3.5">Closed</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5 text-right">Opening Float</th>
                  <th className="p-3.5 text-right">Expected</th>
                  <th className="p-3.5 text-right">Actual</th>
                  <th className="p-3.5 text-right">Discrepancy</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Z-Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading shifts...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center">
                      <Monitor className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-300">No shift history found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Open a shift to start recording sales and transactions.
                      </p>
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift) => {
                    const disc = getDiscrepancyDisplay(shift.discrepancy);
                    const userName = typeof shift.userId === 'object'
                      ? (shift.userId as any).name
                      : shift.userId;

                    return (
                      <tr key={shift._id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="p-3.5 font-mono font-medium text-blue-400">
                          {shift.terminalId}
                        </td>
                        <td className="p-3.5 text-slate-200">{userName}</td>
                        <td className="p-3.5 text-xs text-slate-400">
                          {formatDate(shift.openedAt)}
                        </td>
                        <td className="p-3.5 text-xs text-slate-400">
                          {shift.closedAt ? formatDate(shift.closedAt) : '—'}
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {formatDuration(shift.openedAt, shift.closedAt)}
                        </td>
                        <td className="p-3.5 text-right text-slate-300">
                          {formatCurrency(shift.openingFloat)}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-200">
                          {formatCurrency(shift.expectedCash)}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-200">
                          {shift.actualCash !== undefined ? formatCurrency(shift.actualCash) : '—'}
                        </td>
                        <td className={`p-3.5 text-right font-semibold ${disc.color}`}>
                          <div className="flex items-center justify-end gap-1">
                            {disc.icon}
                            {disc.text}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <Badge variant={shift.status === 'OPEN' ? 'success' : 'neutral'}>
                            {shift.status}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-center">
                          {shift.status === 'CLOSED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/shifts/${shift._id}/z-report`)}
                              title="View Z-Report"
                            >
                              <FileText className="w-4 h-4 text-blue-400" />
                            </Button>
                          )}
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

      {totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Modals */}
      <OpenShiftModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        onSuccess={() => { fetchData(); setShowOpenModal(false); }}
      />

      <CloseShiftModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onSuccess={fetchData}
        shift={activeShiftForClose}
      />

      <PettyCashModal
        isOpen={showPettyModal}
        onClose={() => setShowPettyModal(false)}
        onSuccess={fetchData}
        shiftId={activeShift?._id || null}
      />
    </div>
  );
}
