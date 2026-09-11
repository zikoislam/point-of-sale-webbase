'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  History,
  Lock,
  Unlock,
  RefreshCw,
  X,
  Check,
  Building,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('pos_access_token')}`,
  'Content-Type': 'application/json',
});

interface Shift {
  _id: string;
  userId: { _id: string; name: string; email: string };
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
}

interface ZReportData {
  shift: Shift;
  summary: {
    totalSalesCount: number;
    totalGrossSales: number;
    totalTax: number;
    totalDiscount: number;
    paymentBreakdown: Record<string, number>;
    openingFloat: number;
    cashCollected: number;
    pettyCashIn: number;
    pettyCashOut: number;
    cashExpenses: number;
    expectedCash: number;
    actualCash: number | null;
    discrepancy: number | null;
  };
}

export default function ShiftsPage() {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [historyShifts, setHistoryShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [showZReportModal, setShowZReportModal] = useState(false);
  const [zReport, setZReport] = useState<ZReportData | null>(null);

  // Form states
  const [openFloat, setOpenFloat] = useState(1000);
  const [terminalId, setTerminalId] = useState('COUNTER-01');
  const [openNotes, setOpenNotes] = useState('');

  const [actualCash, setActualCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  const [pettyType, setPettyType] = useState<'IN' | 'OUT'>('IN');
  const [pettyAmount, setPettyAmount] = useState(0);
  const [pettyReason, setPettyReason] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchActiveShift = useCallback(async () => {
    try {
      const res = await fetch(`${API}/shifts/active`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        setActiveShift(j.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/shifts?limit=20`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        setHistoryShifts(j.data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchActiveShift(), fetchHistory()]);
    setLoading(false);
  }, [fetchActiveShift, fetchHistory]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleOpenShift = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API}/shifts/open`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          openingFloat: Number(openFloat),
          terminalId,
          notes: openNotes || undefined,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to open shift');

      setShowOpenModal(false);
      refreshAll();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePettyCash = async () => {
    if (!activeShift) return;
    if (pettyAmount <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }
    if (!pettyReason.trim()) {
      setErrorMsg('Please provide a reason');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API}/shifts/${activeShift._id}/petty-cash`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          type: pettyType,
          amount: Number(pettyAmount),
          reason: pettyReason.trim(),
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to record petty cash');

      setShowPettyModal(false);
      setPettyAmount(0);
      setPettyReason('');
      refreshAll();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API}/shifts/${activeShift._id}/close`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          actualCash: Number(actualCash),
          notes: closeNotes || undefined,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Failed to close shift');

      setShowCloseModal(false);
      // Auto fetch and display Z-Report
      fetchZReport(activeShift._id);
      refreshAll();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const fetchZReport = async (shiftId: string) => {
    try {
      const res = await fetch(`${API}/shifts/${shiftId}/z-report`, { headers: authHeader() });
      const j = await res.json();
      if (j.success) {
        setZReport(j.data);
        setShowZReportModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const printZReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Register Shifts & Z-Report</h1>
            <p className="text-sm text-slate-400">
              Manage cash drawer sessions, mid-shift petty cash drops & end-of-day blind reconciliation
            </p>
          </div>
        </div>

        <button
          onClick={refreshAll}
          className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Active Shift Card or Open Prompt */}
      {activeShift ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Active Drawer Session
                </span>
                <span className="text-xs text-slate-400">• {activeShift.terminalId}</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Cash Drawer is OPEN
              </h2>
              <p className="text-xs text-slate-400">
                Opened by <span className="text-white font-medium">{activeShift.userId?.name}</span> at{' '}
                {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[11px] text-slate-400">Opening Float</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  ৳{activeShift.openingFloat.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[11px] text-emerald-400">Cash Sales</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  ৳{activeShift.cashSalesTotal.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-[11px] text-slate-400">Petty In / Out</div>
                <div className="text-xs font-bold text-slate-300 mt-1 flex items-center space-x-1">
                  <span className="text-emerald-400">+{activeShift.pettyCashIn}</span>
                  <span>/</span>
                  <span className="text-rose-400">-{activeShift.pettyCashOut}</span>
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="text-[11px] text-amber-300 font-semibold">Expected Cash</div>
                <div className="text-sm font-black text-amber-400 mt-0.5">
                  ৳{activeShift.expectedCash.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  setPettyAmount(0);
                  setPettyReason('');
                  setErrorMsg('');
                  setShowPettyModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Petty Cash (In/Drop)
              </button>
              <button
                onClick={() => fetchZReport(activeShift._id)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Interim Z-Report
              </button>
              <button
                onClick={() => {
                  setActualCash(activeShift.expectedCash);
                  setCloseNotes('');
                  setErrorMsg('');
                  setShowCloseModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 flex items-center space-x-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close Shift & Reconcile</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Unlock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">No Active Cash Shift</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Before processing sales on the POS counter, open a new cashier shift and record the starting drawer float.
            </p>
          </div>
          <button
            onClick={() => {
              setOpenFloat(1000);
              setTerminalId('COUNTER-01');
              setOpenNotes('');
              setErrorMsg('');
              setShowOpenModal(true);
            }}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Open Cash Register Shift</span>
          </button>
        </div>
      )}

      {/* Past Shifts History */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-6">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <History className="w-4 h-4 text-slate-400" />
          <span>Shift History & Audit Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-400 tracking-wider">
                <th className="py-3 px-3">Session Date</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3">Terminal</th>
                <th className="py-3 px-3 text-right">Float</th>
                <th className="py-3 px-3 text-right">Cash Sales</th>
                <th className="py-3 px-3 text-right">Expected</th>
                <th className="py-3 px-3 text-right">Counted</th>
                <th className="py-3 px-3 text-right">Discrepancy</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {historyShifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No shift history recorded yet.
                  </td>
                </tr>
              ) : (
                historyShifts.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-medium text-white">
                      {new Date(s.openedAt).toLocaleDateString()}{' '}
                      <span className="text-slate-400 font-normal">
                        ({new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{s.userId?.name || 'Cashier'}</td>
                    <td className="py-3 px-3 text-slate-400">{s.terminalId}</td>
                    <td className="py-3 px-3 text-right text-slate-300">৳{s.openingFloat.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-medium text-emerald-400">
                      ৳{s.cashSalesTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-300 font-medium">
                      ৳{s.expectedCash.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-white font-semibold">
                      {s.actualCash !== undefined ? `৳${s.actualCash.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      {s.discrepancy !== undefined ? (
                        <span
                          className={
                            s.discrepancy === 0
                              ? 'text-emerald-400'
                              : s.discrepancy > 0
                              ? 'text-blue-400'
                              : 'text-rose-400'
                          }
                        >
                          {s.discrepancy > 0 ? `+৳${s.discrepancy.toFixed(2)}` : `৳${s.discrepancy.toFixed(2)}`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'OPEN'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => fetchZReport(s._id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Z-Report"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <h2 className="text-lg font-bold text-white">Open Cash Drawer Shift</h2>
              </div>
              <button
                onClick={() => setShowOpenModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Starting Float in Cash Drawer (৳) *
                </label>
                <input
                  type="number"
                  value={openFloat}
                  onChange={(e) => setOpenFloat(Number(e.target.value))}
                  min={0}
                  step="10"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-base focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Counter / Terminal Identifier
                </label>
                <input
                  type="text"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Opening Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="e.g. Morning Shift"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenShift}
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Start Shift</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Petty Cash Modal */}
      {showPettyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Petty Cash Transaction</h2>
              <button
                onClick={() => setShowPettyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPettyType('IN')}
                  className={`py-2 rounded-lg transition ${
                    pettyType === 'IN'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cash In (+ Add Float)
                </button>
                <button
                  type="button"
                  onClick={() => setPettyType('OUT')}
                  className={`py-2 rounded-lg transition ${
                    pettyType === 'OUT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cash Out (- Drawer Drop)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (৳) *</label>
                <input
                  type="number"
                  value={pettyAmount}
                  onChange={(e) => setPettyAmount(Number(e.target.value))}
                  min={1}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Narration *
                </label>
                <input
                  type="text"
                  value={pettyReason}
                  onChange={(e) => setPettyReason(e.target.value)}
                  placeholder="e.g. Additional change float, Tea expense, Safe drop"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowPettyModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePettyCash}
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Record Petty Cash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Reconciliation Modal */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white">Close Shift & Reconcile</h2>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Starting Float:</span>
                  <span>৳{activeShift.openingFloat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cash Sales Tendered:</span>
                  <span className="text-emerald-400">+৳{activeShift.cashSalesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Petty In / Out:</span>
                  <span>
                    +৳{activeShift.pettyCashIn} / -৳{activeShift.pettyCashOut}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-white">
                  <span>System Expected Cash:</span>
                  <span className="text-amber-400">৳{activeShift.expectedCash.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Physical Cash Counted in Drawer (৳) *
                </label>
                <input
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(Number(e.target.value))}
                  min={0}
                  step="0.01"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-base focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Calculated Discrepancy Preview */}
              <div className="p-3 rounded-xl border flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400">Drawer Difference:</span>
                {actualCash - activeShift.expectedCash === 0 ? (
                  <span className="text-emerald-400">Perfect Match (৳0.00)</span>
                ) : actualCash - activeShift.expectedCash > 0 ? (
                  <span className="text-blue-400">
                    Surplus: +৳{(actualCash - activeShift.expectedCash).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-rose-400">
                    Shortage: ৳{(actualCash - activeShift.expectedCash).toFixed(2)}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Closing Notes (Optional)
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Reasons for discrepancy or handover notes"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Confirm & Lock Shift</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Z-Report Thermal / A4 Modal */}
      {showZReportModal && zReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl font-mono text-xs">
            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-100 rounded-t-2xl">
              <span className="font-bold text-slate-700 uppercase">Z-REPORT AUDIT SLIP</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={printZReport}
                  className="px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowZReportModal(false)}
                  className="text-slate-500 hover:text-slate-900 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Receipt Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h1 className="text-base font-black tracking-tight">POINT OF SALE SYSTEM</h1>
                <p className="text-[10px] text-slate-600 mt-0.5">END-OF-DAY REGISTER Z-REPORT</p>
                <div className="mt-2 text-[10px] text-slate-500">
                  Terminal: {zReport.shift.terminalId} • Shift #{zReport.shift._id.slice(-6).toUpperCase()}
                </div>
                <div className="text-[10px] text-slate-500">
                  Cashier: {zReport.shift.userId?.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  Opened: {new Date(zReport.shift.openedAt).toLocaleString()}
                </div>
                {zReport.shift.closedAt && (
                  <div className="text-[10px] text-slate-500">
                    Closed: {new Date(zReport.shift.closedAt).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Sales Metrics */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>Transactions Count:</span>
                  <span className="font-bold">{zReport.summary.totalSalesCount} bills</span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Sales Total:</span>
                  <span>৳{zReport.summary.totalGrossSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Tax (VAT):</span>
                  <span>৳{zReport.summary.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Discounts:</span>
                  <span>-৳{zReport.summary.totalDiscount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold uppercase text-[10px] text-slate-500">
                  Tender Breakdown
                </div>
                {Object.entries(zReport.summary.paymentBreakdown).map(([method, amount]) => (
                  <div key={method} className="flex justify-between">
                    <span>{method}:</span>
                    <span>৳{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Cash Drawer Reconciliation */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold uppercase text-[10px] text-slate-500">
                  Cash Reconciliation
                </div>
                <div className="flex justify-between">
                  <span>(+) Opening Float:</span>
                  <span>৳{zReport.summary.openingFloat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Cash Sales:</span>
                  <span>৳{zReport.summary.cashCollected.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(+) Petty Cash In:</span>
                  <span>৳{zReport.summary.pettyCashIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(-) Petty Cash Drop:</span>
                  <span>-৳{zReport.summary.pettyCashOut.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                  <span>(=) Expected Cash:</span>
                  <span>৳{zReport.summary.expectedCash.toFixed(2)}</span>
                </div>
                {zReport.summary.actualCash !== null && (
                  <div className="flex justify-between font-bold">
                    <span>(~) Actual Counted:</span>
                    <span>৳{zReport.summary.actualCash.toFixed(2)}</span>
                  </div>
                )}
                {zReport.summary.discrepancy !== null && (
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                    <span>Difference (Over/Short):</span>
                    <span
                      className={
                        zReport.summary.discrepancy === 0
                          ? 'text-emerald-700'
                          : zReport.summary.discrepancy > 0
                          ? 'text-blue-700'
                          : 'text-rose-700'
                      }
                    >
                      {zReport.summary.discrepancy > 0
                        ? `+৳${zReport.summary.discrepancy.toFixed(2)}`
                        : `৳${zReport.summary.discrepancy.toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2">
                Thank you. Shift audit complete.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
